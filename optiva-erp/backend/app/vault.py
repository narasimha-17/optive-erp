"""Vault: document management for Optiva ERP.

Covers storage, version control, approval workflows, e-signatures, access control,
document intelligence, search, retention policies, audit trails and automatic classification.
All routes live under /api/vault and require a signed-in user.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import mimetypes
import re
import shutil
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from . import vault_ai as ai
from .db import connect
from .deps import current_user
from .security import DATA_DIR

VAULT_DIR = DATA_DIR / "vault"
VAULT_DIR.mkdir(parents=True, exist_ok=True)
MAX_BYTES = 15 * 1024 * 1024
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

STATUSES = ["Draft", "Pending approval", "Approved", "Rejected", "Awaiting signature", "Signed", "Archived"]
LOCKED_STATUSES = {"Approved", "Signed", "Pending approval", "Awaiting signature"}

router = APIRouter(prefix="/api/vault", tags=["vault"])


# ------------------------------------------------------------------ helpers
def now_dt() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def add_years(dt: datetime, years: int) -> datetime:
    try:
        return dt.replace(year=dt.year + years)
    except ValueError:  # 29 February
        return dt.replace(year=dt.year + years, day=28)


def is_admin(user: dict) -> bool:
    return user["role"] == "Administrator"


def safe_name(name: str) -> str:
    name = Path(name.replace("\\", "/")).name.strip() or "document"
    return re.sub(r"[^A-Za-z0-9._\- ()]", "_", name)[:120]


def title_from(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    return re.sub(r"\s+", " ", stem.replace("_", " ")).strip()[:140] or "Untitled"


def log(conn: sqlite3.Connection, user: dict, doc: sqlite3.Row | dict | None, action: str, detail: str = "", at: str | None = None) -> None:
    conn.execute(
        "INSERT INTO audit_log (doc_id, doc_title, actor_id, actor_name, action, detail, company, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (doc["id"] if doc else None, doc["title"] if doc else "", user["id"], user["name"], action, detail, user["company"], at or iso(now_dt())),
    )


def retention_until(conn: sqlite3.Connection, policy_id: str | None, start: datetime) -> str | None:
    if not policy_id:
        return None
    row = conn.execute("SELECT years FROM retention_policies WHERE id = ?", (policy_id,)).fetchone()
    if not row or row["years"] == 0:
        return None
    return iso(add_years(start, row["years"]))


def people_map(conn: sqlite3.Connection, company: str) -> dict[int, dict]:
    rows = conn.execute("SELECT id, name, email, role FROM users WHERE company = ?", (company,)).fetchall()
    return {r["id"]: {"id": r["id"], "name": r["name"], "email": r["email"], "role": r["role"]} for r in rows}


# ------------------------------------------------------------ access control
def capabilities(conn: sqlite3.Connection, row: sqlite3.Row, user: dict) -> dict:
    owner = row["owner_id"] == user["id"]
    admin = is_admin(user)
    share = conn.execute("SELECT permission FROM document_shares WHERE doc_id = ? AND email = ?", (row["id"], user["email"])).fetchone()
    assigned = conn.execute("SELECT 1 FROM approvals WHERE doc_id = ? AND approver_id = ?", (row["id"], user["id"])).fetchone()
    signer = conn.execute("SELECT 1 FROM signatures WHERE doc_id = ? AND lower(signer_email) = lower(?)", (row["id"], user["email"])).fetchone()
    can_manage = owner or admin
    can_edit = can_manage or (share is not None and share["permission"] == "edit")
    can_view = can_edit or row["visibility"] == "Company" or share is not None or assigned is not None or signer is not None
    return {"view": can_view, "edit": can_edit, "manage": can_manage, "delete": can_manage}


def load_doc(conn: sqlite3.Connection, doc_id: str, user: dict, need: str = "view") -> tuple[sqlite3.Row, dict]:
    row = conn.execute("SELECT * FROM documents WHERE id = ? AND company = ?", (doc_id, user["company"])).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    caps = capabilities(conn, row, user)
    if not caps["view"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    if need != "view" and not caps[need]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to do this")
    return row, caps


def visible_rows(conn: sqlite3.Connection, user: dict) -> list[sqlite3.Row]:
    return [r for r in conn.execute("SELECT * FROM documents WHERE company = ?", (user["company"],)).fetchall() if capabilities(conn, r, user)["view"]]


# --------------------------------------------------------------- serialisers
def summary(row: sqlite3.Row, people: dict[int, dict]) -> dict:
    owner = people.get(row["owner_id"], {"id": row["owner_id"], "name": "Unknown", "email": "", "role": ""})
    until = parse_iso(row["retention_until"])
    return {
        "id": row["id"],
        "title": row["title"],
        "filename": row["filename"],
        "size": row["size"],
        "docType": row["doc_type"],
        "confidence": row["confidence"],
        "tags": json.loads(row["tags"]),
        "folder": row["folder"],
        "status": row["status"],
        "visibility": row["visibility"],
        "owner": {"id": owner["id"], "name": owner["name"]},
        "retentionPolicy": row["retention_policy"],
        "retentionUntil": row["retention_until"],
        "daysToRetention": (until - now_dt()).days if until else None,
        "legalHold": bool(row["legal_hold"]),
        "version": row["current_version"],
        "archived": bool(row["archived"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def detail(conn: sqlite3.Connection, row: sqlite3.Row, user: dict, caps: dict) -> dict:
    people = people_map(conn, user["company"])
    doc_id = row["id"]
    versions = conn.execute("SELECT * FROM document_versions WHERE doc_id = ? ORDER BY version DESC", (doc_id,)).fetchall()
    approvals = conn.execute("SELECT * FROM approvals WHERE doc_id = ? ORDER BY id DESC", (doc_id,)).fetchall()
    sigs = conn.execute("SELECT * FROM signatures WHERE doc_id = ? ORDER BY id", (doc_id,)).fetchall()
    shares = conn.execute("SELECT email, permission FROM document_shares WHERE doc_id = ? ORDER BY email", (doc_id,)).fetchall()
    audit = conn.execute("SELECT * FROM audit_log WHERE doc_id = ? ORDER BY created_at DESC, id DESC LIMIT 60", (doc_id,)).fetchall()
    policy = conn.execute("SELECT * FROM retention_policies WHERE id = ?", (row["retention_policy"],)).fetchone() if row["retention_policy"] else None
    by_email = {p["email"].lower(): p for p in people.values()}
    cls = ai.classify(row["filename"], row["text_content"])

    return {
        **summary(row, people),
        "caps": {
            **caps,
            "approve": any(a["status"] == "Pending" and (a["approver_id"] == user["id"] or is_admin(user)) for a in approvals),
            "sign": any(s["status"] == "Pending" and s["signer_email"].lower() == user["email"].lower() for s in sigs),
        },
        "preview": row["text_content"][:2400],
        "intelligence": json.loads(row["extracted"]),
        "classification": {"docType": row["doc_type"], "confidence": row["confidence"], "suggestedFolder": cls["folder"], "suggestedRetention": cls["retention_policy"]},
        "versions": [
            {
                "version": v["version"], "filename": v["filename"], "size": v["size"], "sha256": v["sha256"], "note": v["note"],
                "uploadedBy": people.get(v["uploaded_by"], {}).get("name", "Unknown"), "createdAt": v["created_at"],
                "current": v["version"] == row["current_version"],
            }
            for v in versions
        ],
        "approvals": [
            {
                "id": a["id"], "version": a["version"], "status": a["status"], "requestNote": a["request_note"], "comment": a["comment"],
                "requestedBy": people.get(a["requested_by"], {}).get("name", "Unknown"),
                "approver": people.get(a["approver_id"], {"id": a["approver_id"], "name": "Unknown", "email": "", "role": ""}),
                "createdAt": a["created_at"], "decidedAt": a["decided_at"],
                "canDecide": a["status"] == "Pending" and (a["approver_id"] == user["id"] or is_admin(user)),
            }
            for a in approvals
        ],
        "signatures": [
            {
                "id": s["id"], "version": s["version"], "signerName": s["signer_name"], "signerEmail": s["signer_email"], "status": s["status"],
                "typedName": s["typed_name"], "drawing": s["drawing"], "docHash": s["doc_hash"], "signedAt": s["signed_at"], "createdAt": s["created_at"],
                "canSign": s["status"] == "Pending" and s["signer_email"].lower() == user["email"].lower() and s["version"] == row["current_version"],
            }
            for s in sigs
        ],
        "shares": [{"email": s["email"], "permission": s["permission"], "name": by_email.get(s["email"].lower(), {}).get("name", "")} for s in shares],
        "retention": {
            "policy": dict(policy) if policy else None,
            "until": row["retention_until"],
            "legalHold": bool(row["legal_hold"]),
        },
        "audit": [audit_out(a) for a in audit],
    }


def audit_out(a: sqlite3.Row) -> dict:
    return {"id": a["id"], "docId": a["doc_id"], "docTitle": a["doc_title"], "actor": a["actor_name"], "action": a["action"], "detail": a["detail"], "at": a["created_at"]}


# ---------------------------------------------------------- core operations
def decode_upload(content_b64: str) -> bytes:
    try:
        data = base64.b64decode(content_b64.split(",", 1)[-1], validate=False)
    except (binascii.Error, ValueError):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The file could not be read")
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The file is empty")
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Files can be up to 15 MB")
    return data


def store_version(conn: sqlite3.Connection, doc_id: str, version: int, filename: str, data: bytes, note: str, user: dict, at: str) -> None:
    folder = VAULT_DIR / doc_id
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"v{version}_{safe_name(filename)}"
    path.write_bytes(data)
    conn.execute(
        "INSERT INTO document_versions (doc_id, version, filename, size, sha256, path, note, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (doc_id, version, filename, len(data), hashlib.sha256(data).hexdigest(), str(path), note, user["id"], at),
    )


def create_document(
    conn: sqlite3.Connection, user: dict, filename: str, data: bytes, mime: str = "", folder: str | None = None,
    title: str | None = None, note: str = "", at: datetime | None = None, visibility: str = "Company",
) -> sqlite3.Row:
    created = at or now_dt()
    stamp = iso(created)
    filename = safe_name(filename)
    text = ai.extract_text(filename, data)
    cls = ai.classify(filename, text)
    intel = ai.intelligence(text, cls["doc_type"])
    doc_id = uuid.uuid4().hex[:12]
    conn.execute(
        """INSERT INTO documents (id, title, filename, mime, size, doc_type, confidence, tags, folder, status, visibility, owner_id, company,
           retention_policy, retention_until, legal_hold, current_version, text_content, extracted, archived, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,'Draft',?,?,?,?,?,0,1,?,?,0,?,?)""",
        (
            doc_id, (title or title_from(filename)).strip()[:140], filename, mime or mimetypes.guess_type(filename)[0] or "application/octet-stream",
            len(data), cls["doc_type"], cls["confidence"], json.dumps(cls["tags"]), folder if folder in ai.FOLDERS else cls["folder"],
            visibility, user["id"], user["company"], cls["retention_policy"], retention_until(conn, cls["retention_policy"], created),
            text[:60000], json.dumps(intel), stamp, stamp,
        ),
    )
    store_version(conn, doc_id, 1, filename, data, note or "Initial upload", user, stamp)
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    log(conn, user, row, "Uploaded", f"{filename}, classified as {cls['doc_type']} ({int(cls['confidence'] * 100)}% confidence), filed in {row['folder']}", stamp)
    return row


def add_version(conn: sqlite3.Connection, user: dict, row: sqlite3.Row, filename: str, data: bytes, note: str, action: str = "Version added", at: datetime | None = None) -> sqlite3.Row:
    stamp = iso(at or now_dt())
    filename = safe_name(filename)
    version = row["current_version"] + 1
    text = ai.extract_text(filename, data)
    intel = ai.intelligence(text, row["doc_type"])
    store_version(conn, row["id"], version, filename, data, note, user, stamp)
    new_status = "Draft" if row["status"] in ("Approved", "Signed", "Rejected", "Awaiting signature", "Pending approval") else row["status"]
    conn.execute(
        "UPDATE documents SET filename=?, size=?, current_version=?, text_content=?, extracted=?, status=?, updated_at=? WHERE id=?",
        (filename, len(data), version, text[:60000], json.dumps(intel), new_status, stamp, row["id"]),
    )
    # an old approval or signature request no longer applies to the changed file
    conn.execute("UPDATE approvals SET status='Superseded' WHERE doc_id=? AND status='Pending'", (row["id"],))
    conn.execute("UPDATE signatures SET status='Cancelled' WHERE doc_id=? AND status='Pending'", (row["id"],))
    fresh = conn.execute("SELECT * FROM documents WHERE id = ?", (row["id"],)).fetchone()
    detail_text = f"v{version}: {note or filename}" + (" (approval and signature status reset)" if new_status != row["status"] else "")
    log(conn, user, fresh, action, detail_text, stamp)
    return fresh


# ------------------------------------------------------------------ schemas
class UploadIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    content_b64: str
    mime: str = ""
    folder: str | None = None
    title: str | None = None
    note: str = ""
    visibility: Literal["Private", "Company"] = "Company"


class VersionIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    content_b64: str
    note: str = ""


class PatchIn(BaseModel):
    title: str | None = None
    folder: str | None = None
    doc_type: str | None = None
    tags: list[str] | None = None
    retention_policy: str | None = None
    legal_hold: bool | None = None
    archived: bool | None = None

    @field_validator("tags")
    @classmethod
    def _tags(cls, v):
        return None if v is None else [t.strip()[:30] for t in v if t.strip()][:10]


class ShareIn(BaseModel):
    email: str
    permission: Literal["view", "edit"] = "view"

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("enter a valid email address")
        return v


class AccessIn(BaseModel):
    visibility: Literal["Private", "Company"]
    shares: list[ShareIn] = []


class ApprovalIn(BaseModel):
    approver_id: int
    note: str = ""


class DecisionIn(BaseModel):
    decision: Literal["Approved", "Rejected"]
    comment: str = ""


class SignerIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("enter a valid email address")
        return v


class SignatureRequestIn(BaseModel):
    signers: list[SignerIn] = Field(min_length=1, max_length=6)


class SignIn(BaseModel):
    typed_name: str = Field(min_length=2, max_length=80)
    consent: bool
    drawing: str = ""


# ------------------------------------------------------------------- routes
@router.get("/people")
def people(user: dict = Depends(current_user)) -> list[dict]:
    with connect() as conn:
        return sorted(people_map(conn, user["company"]).values(), key=lambda p: p["name"])


@router.get("/overview")
def overview(user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        rows = visible_rows(conn, user)
        people = people_map(conn, user["company"])
        live = [r for r in rows if not r["archived"]]
        ids = {r["id"] for r in rows}
        horizon = now_dt() + timedelta(days=90)
        expiring = [r for r in live if (u := parse_iso(r["retention_until"])) and u <= horizon]
        my_approvals = conn.execute(
            "SELECT doc_id FROM approvals WHERE status = 'Pending' AND approver_id = ?", (user["id"],)
        ).fetchall()
        my_sigs = conn.execute(
            "SELECT doc_id FROM signatures WHERE status = 'Pending' AND lower(signer_email) = lower(?)", (user["email"],)
        ).fetchall()
        storage = sum(
            v["size"] for v in conn.execute("SELECT doc_id, size FROM document_versions").fetchall() if v["doc_id"] in ids
        )
        folders = {f: 0 for f in ai.FOLDERS}
        statuses = {s: 0 for s in STATUSES}
        types: dict[str, int] = {}
        for r in live:
            folders[r["folder"]] = folders.get(r["folder"], 0) + 1
            types[r["doc_type"]] = types.get(r["doc_type"], 0) + 1
        for r in rows:
            statuses[r["status"]] = statuses.get(r["status"], 0) + 1
        activity = [
            audit_out(a)
            for a in conn.execute("SELECT * FROM audit_log WHERE company = ? ORDER BY created_at DESC, id DESC LIMIT 80", (user["company"],)).fetchall()
            if is_admin(user) or a["doc_id"] in ids or a["actor_id"] == user["id"]
        ][:6]
    return {
        "total": len(live),
        "pendingApprovals": len([a for a in my_approvals if a["doc_id"] in ids]),
        "awaitingSignature": len([s for s in my_sigs if s["doc_id"] in ids]),
        "expiringSoon": len(expiring),
        "storageBytes": storage,
        "folders": folders,
        "statuses": statuses,
        "types": dict(sorted(types.items(), key=lambda kv: -kv[1])),
        "recent": activity,
        "people": len(people),
    }


@router.get("/documents")
def list_documents(
    q: str = "", folder: str = "", doc_type: str = "", doc_status: str = Query("", alias="status"),
    sort: Literal["relevance", "updated", "name", "size"] = "relevance", user: dict = Depends(current_user),
) -> dict:
    with connect() as conn:
        people = people_map(conn, user["company"])
        rows = visible_rows(conn, user)
        want_archived = doc_status == "Archived"
        pool = []
        for r in rows:
            if bool(r["archived"]) != want_archived:
                continue
            d = summary(r, people)
            d.update({"text_content": r["text_content"], "extracted": json.loads(r["extracted"]), "doc_type": r["doc_type"],
                      "retention_until": r["retention_until"], "created_at": r["created_at"], "updated_at": r["updated_at"]})
            pool.append(d)

    parsed = ai.parse_query(q) if q.strip() else {"filters": {"types": set(), "statuses": set(), "min_amount": None, "max_amount": None, "since": None, "until": None, "expiring": False}, "terms": [], "chips": []}
    results = ai.search(pool, parsed)

    def explicit(d: dict) -> bool:
        return (not folder or d["folder"] == folder) and (not doc_type or d["docType"] == doc_type) and (not doc_status or d["status"] == doc_status)

    results = [d for d in results if explicit(d)]
    if sort == "updated" or (sort == "relevance" and not parsed["terms"]):
        results.sort(key=lambda d: d["updatedAt"], reverse=True)
    elif sort == "name":
        results.sort(key=lambda d: d["title"].lower())
    elif sort == "size":
        results.sort(key=lambda d: -d["size"])
    else:
        results.sort(key=lambda d: (d["score"], d["updatedAt"]), reverse=True)

    out = []
    for d in results:
        out.append({k: d[k] for k in (
            "id", "title", "filename", "size", "docType", "confidence", "tags", "folder", "status", "visibility", "owner", "retentionUntil",
            "daysToRetention", "legalHold", "version", "createdAt", "updatedAt", "archived",
        )} | {"score": d["score"], "snippet": d["snippet"], "matched": d["matched"]})
    return {"results": out, "total": len(out), "interpreted": parsed["chips"], "terms": parsed["terms"]}


@router.post("/documents", status_code=201)
def upload(body: UploadIn, user: dict = Depends(current_user)) -> dict:
    data = decode_upload(body.content_b64)
    with connect() as conn:
        row = create_document(conn, user, body.filename, data, body.mime, body.folder, body.title, body.note, visibility=body.visibility)
        return detail(conn, row, user, capabilities(conn, row, user))


@router.get("/documents/{doc_id}")
def get_document(doc_id: str, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, caps = load_doc(conn, doc_id, user)
        recent = conn.execute(
            "SELECT created_at FROM audit_log WHERE doc_id=? AND actor_id=? AND action='Viewed' ORDER BY id DESC LIMIT 1", (doc_id, user["id"])
        ).fetchone()
        last = parse_iso(recent["created_at"]) if recent else None
        if not last or now_dt() - last > timedelta(minutes=10):
            log(conn, user, row, "Viewed", "Opened the document")
        return detail(conn, row, user, caps)


@router.get("/documents/{doc_id}/download")
def download(doc_id: str, version: int | None = None, user: dict = Depends(current_user)):
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user)
        number = version or row["current_version"]
        v = conn.execute("SELECT * FROM document_versions WHERE doc_id=? AND version=?", (doc_id, number)).fetchone()
        if v is None or not Path(v["path"]).exists():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
        log(conn, user, row, "Downloaded", f"v{number}, {v['filename']}")
    return FileResponse(v["path"], filename=v["filename"], media_type=row["mime"] or "application/octet-stream")


@router.post("/documents/{doc_id}/versions", status_code=201)
def new_version(doc_id: str, body: VersionIn, user: dict = Depends(current_user)) -> dict:
    data = decode_upload(body.content_b64)
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "edit")
        fresh = add_version(conn, user, row, body.filename, data, body.note.strip())
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.post("/documents/{doc_id}/versions/{number}/restore")
def restore_version(doc_id: str, number: int, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "edit")
        v = conn.execute("SELECT * FROM document_versions WHERE doc_id=? AND version=?", (doc_id, number)).fetchone()
        if v is None or not Path(v["path"]).exists():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Version not found")
        if number == row["current_version"]:
            raise HTTPException(status.HTTP_409_CONFLICT, "That is already the current version")
        fresh = add_version(conn, user, row, v["filename"], Path(v["path"]).read_bytes(), f"Restored from v{number}", "Version restored")
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.patch("/documents/{doc_id}")
def patch_document(doc_id: str, body: PatchIn, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "edit")
        manage_only = body.retention_policy is not None or body.legal_hold is not None or body.archived is not None
        if manage_only and not capabilities(conn, row, user)["manage"]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner or an administrator can change retention or archive a document")
        changes: dict = {}
        notes: list[str] = []
        if body.title is not None and body.title.strip() and body.title.strip() != row["title"]:
            changes["title"] = body.title.strip()[:140]
            notes.append(f"title → {changes['title']}")
        if body.folder is not None and body.folder in ai.FOLDERS and body.folder != row["folder"]:
            changes["folder"] = body.folder
            notes.append(f"folder → {body.folder}")
        if body.doc_type is not None and body.doc_type in ai.DOC_TYPES and body.doc_type != row["doc_type"]:
            changes["doc_type"] = body.doc_type
            changes["confidence"] = 1.0
            notes.append(f"type → {body.doc_type} (set manually)")
        if body.tags is not None:
            changes["tags"] = json.dumps(body.tags)
            notes.append("tags updated")
        if body.retention_policy is not None and body.retention_policy != row["retention_policy"]:
            if not conn.execute("SELECT 1 FROM retention_policies WHERE id=?", (body.retention_policy,)).fetchone():
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown retention policy")
            changes["retention_policy"] = body.retention_policy
            changes["retention_until"] = retention_until(conn, body.retention_policy, parse_iso(row["created_at"]) or now_dt())
            notes.append(f"retention → {body.retention_policy}")
        if body.legal_hold is not None and bool(body.legal_hold) != bool(row["legal_hold"]):
            changes["legal_hold"] = int(body.legal_hold)
            log(conn, user, row, "Legal hold set" if body.legal_hold else "Legal hold released", "Deletion and disposal " + ("blocked" if body.legal_hold else "allowed again"))
        if body.archived is not None and bool(body.archived) != bool(row["archived"]):
            if body.archived and row["legal_hold"]:
                raise HTTPException(status.HTTP_409_CONFLICT, "This document is under legal hold and cannot be archived")
            changes["archived"] = int(body.archived)
            changes["status"] = "Archived" if body.archived else "Draft"
            log(conn, user, row, "Archived" if body.archived else "Restored from archive", "")
        if changes:
            changes["updated_at"] = iso(now_dt())
            conn.execute(f"UPDATE documents SET {', '.join(k + '=?' for k in changes)} WHERE id=?", [*changes.values(), doc_id])
            if notes:
                log(conn, user, row, "Metadata updated", "; ".join(notes))
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.post("/documents/{doc_id}/reclassify")
def reclassify(doc_id: str, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "edit")
        cls = ai.classify(row["filename"], row["text_content"])
        intel = ai.intelligence(row["text_content"], cls["doc_type"])
        conn.execute(
            "UPDATE documents SET doc_type=?, confidence=?, tags=?, extracted=?, updated_at=? WHERE id=?",
            (cls["doc_type"], cls["confidence"], json.dumps(cls["tags"]), json.dumps(intel), iso(now_dt()), doc_id),
        )
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        log(conn, user, fresh, "Reclassified", f"{cls['doc_type']} ({int(cls['confidence'] * 100)}% confidence)")
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.put("/documents/{doc_id}/access")
def set_access(doc_id: str, body: AccessIn, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "manage")
        owner_email = people_map(conn, user["company"]).get(row["owner_id"], {}).get("email", "")
        shares = {s.email: s.permission for s in body.shares if s.email != owner_email.lower()}
        conn.execute("DELETE FROM document_shares WHERE doc_id=?", (doc_id,))
        for email, perm in shares.items():
            conn.execute("INSERT INTO document_shares (doc_id, email, permission) VALUES (?,?,?)", (doc_id, email, perm))
        conn.execute("UPDATE documents SET visibility=?, updated_at=? WHERE id=?", (body.visibility, iso(now_dt()), doc_id))
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        shared = ", ".join(f"{e} ({p})" for e, p in shares.items()) or "nobody else"
        log(conn, user, fresh, "Access changed", f"Visibility: {body.visibility}; shared with {shared}")
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "delete")
        if row["legal_hold"]:
            raise HTTPException(status.HTTP_409_CONFLICT, "This document is under legal hold and cannot be deleted")
        until = parse_iso(row["retention_until"])
        if until and until > now_dt() and row["status"] != "Draft":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"The retention policy keeps this document until {until.strftime('%d %b %Y')}. You can archive it instead.",
            )
        log(conn, user, row, "Deleted", f"{row['filename']} permanently removed")
        for table in ("document_versions", "document_shares", "approvals", "signatures"):
            conn.execute(f"DELETE FROM {table} WHERE doc_id=?", (doc_id,))
        conn.execute("DELETE FROM documents WHERE id=?", (doc_id,))
    shutil.rmtree(VAULT_DIR / doc_id, ignore_errors=True)
    return {"deleted": doc_id}


# ----------------------------------------------------------------- approvals
@router.post("/documents/{doc_id}/approvals", status_code=201)
def request_approval(doc_id: str, body: ApprovalIn, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "edit")
        approver = people_map(conn, user["company"]).get(body.approver_id)
        if approver is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose an approver from your company")
        if approver["id"] == user["id"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You cannot approve your own request. Choose a colleague.")
        if row["status"] in ("Pending approval", "Awaiting signature", "Archived"):
            raise HTTPException(status.HTTP_409_CONFLICT, f"A document that is '{row['status']}' cannot be sent for approval")
        stamp = iso(now_dt())
        conn.execute(
            "INSERT INTO approvals (doc_id, version, requested_by, approver_id, status, request_note, created_at) VALUES (?,?,?,?, 'Pending', ?, ?)",
            (doc_id, row["current_version"], user["id"], approver["id"], body.note.strip(), stamp),
        )
        conn.execute("UPDATE documents SET status='Pending approval', updated_at=? WHERE id=?", (stamp, doc_id))
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        log(conn, user, fresh, "Approval requested", f"Sent to {approver['name']} for v{row['current_version']}", stamp)
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.post("/approvals/{approval_id}/decide")
def decide(approval_id: int, body: DecisionIn, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        a = conn.execute("SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
        if a is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Approval not found")
        row, _ = load_doc(conn, a["doc_id"], user)
        if a["status"] != "Pending":
            raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been decided")
        if a["approver_id"] != user["id"] and not is_admin(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the assigned approver can decide this request")
        if body.decision == "Rejected" and not body.comment.strip():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Add a comment explaining the rejection")
        stamp = iso(now_dt())
        conn.execute("UPDATE approvals SET status=?, comment=?, decided_at=? WHERE id=?", (body.decision, body.comment.strip(), stamp, approval_id))
        conn.execute("UPDATE documents SET status=?, updated_at=? WHERE id=?", (body.decision, stamp, row["id"]))
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (row["id"],)).fetchone()
        on_behalf = "" if a["approver_id"] == user["id"] else " (administrator override)"
        log(conn, user, fresh, body.decision, (body.comment.strip() or "No comment") + on_behalf, stamp)
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.get("/approvals")
def approvals(user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        people = people_map(conn, user["company"])
        ids = {r["id"]: r for r in visible_rows(conn, user)}
        out = {"assigned": [], "requested": []}
        for a in conn.execute("SELECT * FROM approvals ORDER BY id DESC").fetchall():
            doc = ids.get(a["doc_id"])
            if doc is None:
                continue
            item = {
                "id": a["id"], "docId": doc["id"], "docTitle": doc["title"], "docType": doc["doc_type"], "version": a["version"],
                "status": a["status"], "requestNote": a["request_note"], "comment": a["comment"],
                "requestedBy": people.get(a["requested_by"], {}).get("name", "Unknown"),
                "approver": people.get(a["approver_id"], {}).get("name", "Unknown"), "createdAt": a["created_at"], "decidedAt": a["decided_at"],
            }
            if a["approver_id"] == user["id"] or (is_admin(user) and a["status"] == "Pending"):
                out["assigned"].append(item)
            if a["requested_by"] == user["id"]:
                out["requested"].append(item)
        return out


# --------------------------------------------------------------- e-signatures
@router.post("/documents/{doc_id}/signatures", status_code=201)
def request_signatures(doc_id: str, body: SignatureRequestIn, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "edit")
        if row["status"] in ("Pending approval", "Awaiting signature", "Archived", "Signed"):
            raise HTTPException(status.HTTP_409_CONFLICT, f"A document that is '{row['status']}' cannot be sent for signature")
        if len({s.email for s in body.signers}) != len(body.signers):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Each signer must have a different email address")
        stamp = iso(now_dt())
        for s in body.signers:
            conn.execute(
                "INSERT INTO signatures (doc_id, version, signer_name, signer_email, status, requested_by, created_at) VALUES (?,?,?,?, 'Pending', ?, ?)",
                (doc_id, row["current_version"], s.name.strip(), s.email, user["id"], stamp),
            )
        conn.execute("UPDATE documents SET status='Awaiting signature', updated_at=? WHERE id=?", (stamp, doc_id))
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        log(conn, user, fresh, "Signature requested", "From " + ", ".join(f"{s.name} <{s.email}>" for s in body.signers), stamp)
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.post("/documents/{doc_id}/signatures/cancel")
def cancel_signatures(doc_id: str, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        row, _ = load_doc(conn, doc_id, user, "edit")
        pending = conn.execute("SELECT COUNT(*) AS n FROM signatures WHERE doc_id=? AND status='Pending'", (doc_id,)).fetchone()["n"]
        if not pending:
            raise HTTPException(status.HTTP_409_CONFLICT, "There are no pending signature requests")
        stamp = iso(now_dt())
        conn.execute("UPDATE signatures SET status='Cancelled' WHERE doc_id=? AND status='Pending'", (doc_id,))
        conn.execute("UPDATE documents SET status='Draft', updated_at=? WHERE id=?", (stamp, doc_id))
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        log(conn, user, fresh, "Signature request cancelled", f"{pending} pending signature(s) withdrawn", stamp)
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.post("/signatures/{signature_id}/sign")
def sign(signature_id: int, body: SignIn, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        s = conn.execute("SELECT * FROM signatures WHERE id=?", (signature_id,)).fetchone()
        if s is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Signature request not found")
        row, _ = load_doc(conn, s["doc_id"], user)
        if s["signer_email"].lower() != user["email"].lower():
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the named signer can sign this document")
        if s["status"] != "Pending":
            raise HTTPException(status.HTTP_409_CONFLICT, "This signature request is no longer open")
        if s["version"] != row["current_version"]:
            raise HTTPException(status.HTTP_409_CONFLICT, "The document changed after this request was sent. Ask for a new request.")
        if not body.consent:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Confirm that you agree to sign electronically")
        if body.drawing and (not body.drawing.startswith("data:image/png;base64,") or len(body.drawing) > 300_000):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The drawn signature is not valid")
        v = conn.execute("SELECT sha256 FROM document_versions WHERE doc_id=? AND version=?", (row["id"], s["version"])).fetchone()
        stamp = iso(now_dt())
        conn.execute(
            "UPDATE signatures SET status='Signed', typed_name=?, drawing=?, doc_hash=?, signed_at=? WHERE id=?",
            (body.typed_name.strip(), body.drawing, v["sha256"], stamp, signature_id),
        )
        left = conn.execute("SELECT COUNT(*) AS n FROM signatures WHERE doc_id=? AND version=? AND status='Pending'", (row["id"], s["version"])).fetchone()["n"]
        if left == 0:
            conn.execute("UPDATE documents SET status='Signed', updated_at=? WHERE id=?", (stamp, row["id"]))
        else:
            conn.execute("UPDATE documents SET updated_at=? WHERE id=?", (stamp, row["id"]))
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (row["id"],)).fetchone()
        log(conn, user, fresh, "Signed", f"{body.typed_name.strip()} signed v{s['version']} (SHA-256 {v['sha256'][:12]}…)" + ("; all signatures collected" if left == 0 else f"; {left} still to sign"), stamp)
        return detail(conn, fresh, user, capabilities(conn, fresh, user))


@router.post("/signatures/{signature_id}/remind")
def remind(signature_id: int, user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        s = conn.execute("SELECT * FROM signatures WHERE id=?", (signature_id,)).fetchone()
        if s is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Signature request not found")
        row, _ = load_doc(conn, s["doc_id"], user, "edit")
        if s["status"] != "Pending":
            raise HTTPException(status.HTTP_409_CONFLICT, "This request is not pending")
        log(conn, user, row, "Signature reminder", f"Reminder sent to {s['signer_name']} <{s['signer_email']}>")
    return {"sent": True}


@router.get("/signatures")
def signatures(user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        ids = {r["id"]: r for r in visible_rows(conn, user)}
        people = people_map(conn, user["company"])
        to_sign, sent = [], []
        for s in conn.execute("SELECT * FROM signatures ORDER BY id DESC").fetchall():
            doc = ids.get(s["doc_id"])
            if doc is None:
                continue
            item = {
                "id": s["id"], "docId": doc["id"], "docTitle": doc["title"], "docType": doc["doc_type"], "version": s["version"],
                "signerName": s["signer_name"], "signerEmail": s["signer_email"], "status": s["status"], "signedAt": s["signed_at"],
                "requestedBy": people.get(s["requested_by"], {}).get("name", "Unknown"), "createdAt": s["created_at"],
                "canSign": s["status"] == "Pending" and s["signer_email"].lower() == user["email"].lower() and s["version"] == doc["current_version"],
            }
            if s["signer_email"].lower() == user["email"].lower():
                to_sign.append(item)
            if s["requested_by"] == user["id"] or (is_admin(user) and s["signer_email"].lower() != user["email"].lower()):
                sent.append(item)
        return {"toSign": to_sign, "sent": sent}


# ---------------------------------------------------------------- retention
@router.get("/retention")
def retention(user: dict = Depends(current_user)) -> dict:
    with connect() as conn:
        people = people_map(conn, user["company"])
        rows = [r for r in visible_rows(conn, user)]
        policies = [dict(p) for p in conn.execute("SELECT * FROM retention_policies ORDER BY years DESC, name").fetchall()]
    now = now_dt()
    for p in policies:
        mine = [r for r in rows if r["retention_policy"] == p["id"]]
        p["documents"] = len(mine)
        p["due"] = len([r for r in mine if (u := parse_iso(r["retention_until"])) and u <= now])
    upcoming = []
    for r in rows:
        until = parse_iso(r["retention_until"])
        if until and until <= now + timedelta(days=365):
            item = summary(r, people)
            item["daysLeft"] = (until - now).days
            upcoming.append(item)
    upcoming.sort(key=lambda d: d["daysLeft"])
    return {
        "policies": policies,
        "upcoming": upcoming,
        "legalHold": len([r for r in rows if r["legal_hold"]]),
        "overdue": len([u for u in upcoming if u["daysLeft"] < 0]),
    }


# -------------------------------------------------------------------- audit
@router.get("/audit")
def audit(
    doc_id: str = "", action: str = "", q: str = "", limit: int = Query(200, ge=1, le=1000), user: dict = Depends(current_user)
) -> dict:
    with connect() as conn:
        ids = {r["id"] for r in visible_rows(conn, user)}
        rows = conn.execute("SELECT * FROM audit_log WHERE company = ? ORDER BY created_at DESC, id DESC", (user["company"],)).fetchall()
        actions = sorted({r["action"] for r in rows})
    needle = q.strip().lower()
    out = []
    for a in rows:
        if not (is_admin(user) or a["doc_id"] in ids or a["actor_id"] == user["id"]):
            continue
        if doc_id and a["doc_id"] != doc_id:
            continue
        if action and a["action"] != action:
            continue
        if needle and needle not in f"{a['actor_name']} {a['detail']} {a['doc_title']} {a['action']}".lower():
            continue
        out.append(audit_out(a))
        if len(out) >= limit:
            break
    return {"entries": out, "actions": actions}


# --------------------------------------------------------------------- seed
def _demo_text(kind: str) -> str:
    texts = {
        "agreement": """SUPPLIER AGREEMENT

This Supplier Agreement is made between Acme Corporation (the "Buyer") and Kestrel Industries Pvt Ltd (the "Supplier"), effective 1 September 2026.

Supplier: Kestrel Industries Pvt Ltd
Buyer: Acme Corporation

1. Supply. The Supplier shall deliver control panels and sensors against purchase orders (for example PO-88214) issued by the Buyer.
2. Pricing. The agreed annual commitment is Rs 85,00,000, invoiced monthly with payment terms of 30 days.
3. Term. This Agreement runs for 24 months and renews automatically for successive 12 month periods unless terminated with 60 days notice.
4. Penalties. Late deliveries attract liquidated damages of 0.5% of the order value per week, capped at 5%.
5. Governing law. This Agreement is governed by the laws of India.

Authorised signatory for the Buyer: ____________    Authorised signatory for the Supplier: ____________
""",
        "invoice": """TAX INVOICE INV-20418

Bill To: Northwind Traders
Invoice date: 28 September 2026
Due date: 28 October 2026
Payment terms: net 30 days

Hydraulic pumps HP-220 x 24 units ........ Rs 3,60,000
Installation and freight .................. Rs 30,000
Subtotal: Rs 3,90,000
GST 18%: Rs 70,200
Amount due: Rs 4,60,200

Late payment attracts interest on delayed payments at 1.5% per month.
Contact: accounts@acme.com
""",
        "po": """PURCHASE ORDER PO-88214

Vendor: Kestrel Industries Pvt Ltd
Ship to: Warehouse B, Pune
PO number: PO-88214
Delivery date: 15 October 2026

Item                         Qty   Unit price     Total
Control panel CP-9            8     Rs 85,000     Rs 6,80,000

Order total: Rs 6,80,000
Requested by Procurement. Approval required above Rs 5,00,000.
""",
        "nda": """MUTUAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement is between Acme Corporation and Brightfield Retail Ltd, effective 12 August 2026.

Disclosing Party: Acme Corporation
Receiving Party: Brightfield Retail Ltd

Each party agrees to keep the other's Confidential Information secret for five years. Either party may terminate this agreement with 30 days written notice. Governing law: India.

Signed by authorised signatories of both parties.
""",
        "policy": """EMPLOYEE LEAVE POLICY 2026

Purpose: This policy sets out the leave entitlements for all employees of Acme Corporation.
Scope: Applies to full-time and part-time employees in every branch.

Employees must comply with the approval procedure. Annual leave is 24 days per calendar year. Sick leave is 12 days. Managers are responsible for approving requests within two working days.

Policy owner: People Operations. Reviewed: 2 January 2026.
""",
        "minutes": """Q3 BOARD MEETING MINUTES

Meeting date: 30 September 2026
Attendees: Alex Morgan, Priya Nair, Daniel Brooks, Meera Shah

Agenda: Q3 results, supplier consolidation, hiring plan.
Resolved: The board approved a budget of Rs 1.2 crore for warehouse automation.
Action items: Priya to circulate the Q3 revenue report; Daniel to confirm vendor shortlist by 15 October 2026.
""",
        "offer": """OFFER LETTER

Candidate: Rohan Mehta
Designation: Senior Accountant
Joining date: 1 November 2026

Dear Rohan, we are pleased to offer you the position of Senior Accountant. Your annual salary will be Rs 14,40,000. This offer is subject to background verification.

HR contact: meera.shah@acme.com
""",
        "report": """Q3 REVENUE REPORT

Fiscal quarter: Q3 2026-27
Revenue for the quarter was Rs 7.4 crore, up 18.4% on the previous quarter. EBITDA improved to 21% and cash flow from operations was Rs 1.9 crore.
Variance to budget: +4.2%. Receivables fell 7.8% as collections improved.
""",
        "checklist": """WAREHOUSE B SAFETY CHECKLIST 2023

Inspect fire exits, racking load limits and forklift certification each quarter. Record findings and sign off monthly. Report incidents to the Operations Head the same day.
""",
        "quote": """QUOTATION QT-3321

Prepared for: Lakeshore Foods
Scope of work: supply and installation of 60 cold-chain sensors with monitoring dashboard.
Pricing: Rs 1,92,400 inclusive of delivery. Validity: 30 days from 1 October 2026.
Deliverables: sensors, gateway, configuration and training.
""",
    }
    return texts[kind]


def seed_vault() -> None:
    """Populate demo documents once, so the Vault has realistic content on first run."""
    with connect() as conn:
        if conn.execute("SELECT 1 FROM documents LIMIT 1").fetchone():
            return
        users = {r["email"]: dict(r) for r in conn.execute("SELECT * FROM users").fetchall()}
        alex = users.get("demo@optiva.com")
        priya = users.get("priya.nair@acme.com")
        daniel = users.get("daniel.brooks@acme.com")
        meera = users.get("meera.shah@acme.com")
        if not (alex and priya and daniel and meera):
            return
        now = now_dt()

        def ago(days: float) -> datetime:
            return now - timedelta(days=days)

        def make(owner, filename, kind, days, folder=None, title=None, visibility="Company"):
            row = create_document(conn, owner, filename, _demo_text(kind).encode(), "text/plain", folder, title, at=ago(days), visibility=visibility)
            return row

        def approval(row, requester, approver, status_, days, note="", comment=""):
            stamp = iso(ago(days))
            conn.execute(
                "INSERT INTO approvals (doc_id, version, requested_by, approver_id, status, request_note, comment, decided_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (row["id"], row["current_version"], requester["id"], approver["id"], status_, note, comment, None if status_ == "Pending" else iso(ago(days - 0.4)), stamp),
            )
            log(conn, requester, row, "Approval requested", f"Sent to {approver['name']}", stamp)
            if status_ != "Pending":
                log(conn, approver, row, status_, comment or "No comment", iso(ago(days - 0.4)))

        def set_status(row, status_, days):
            conn.execute("UPDATE documents SET status=?, updated_at=? WHERE id=?", (status_, iso(ago(days)), row["id"]))

        def sig(row, requester, name, email, signed_by_days=None, user=None):
            stamp = iso(ago(5))
            h = conn.execute("SELECT sha256 FROM document_versions WHERE doc_id=? AND version=?", (row["id"], row["current_version"])).fetchone()["sha256"]
            if signed_by_days is None:
                conn.execute("INSERT INTO signatures (doc_id, version, signer_name, signer_email, status, requested_by, created_at) VALUES (?,?,?,?, 'Pending', ?, ?)",
                             (row["id"], row["current_version"], name, email, requester["id"], stamp))
            else:
                when = iso(ago(signed_by_days))
                conn.execute("INSERT INTO signatures (doc_id, version, signer_name, signer_email, status, typed_name, doc_hash, requested_by, signed_at, created_at) VALUES (?,?,?,?, 'Signed', ?, ?, ?, ?, ?)",
                             (row["id"], row["current_version"], name, email, name, h, requester["id"], when, stamp))
                log(conn, user, row, "Signed", f"{name} signed v{row['current_version']} (SHA-256 {h[:12]}…)", when)

        # 1. contract awaiting signatures (two versions)
        d = make(meera, "Supplier Agreement - Kestrel Industries.txt", "agreement", 9)
        d = add_version(conn, meera, d, "Supplier Agreement - Kestrel Industries.txt", (_demo_text("agreement") + "\nAmendment: payment terms confirmed at 30 days.\n").encode(), "Legal review comments applied", at=ago(7))
        approval(d, meera, daniel, "Approved", 7, "Legal review complete", "Terms look fine.")
        sig(d, meera, "Alex Morgan", "demo@optiva.com")
        sig(d, meera, "Kestrel Industries (Authorised signatory)", "legal@kestrel-industries.example")
        log(conn, meera, d, "Signature requested", "From Alex Morgan <demo@optiva.com>, Kestrel Industries <legal@kestrel-industries.example>", iso(ago(5)))
        set_status(d, "Awaiting signature", 5)
        conn.execute("UPDATE documents SET retention_policy='ret-contract', legal_hold=0 WHERE id=?", (d["id"],))
        conn.execute("INSERT OR REPLACE INTO document_shares (doc_id, email, permission) VALUES (?,?,'view')", (d["id"], "legal@kestrel-industries.example"))

        # 2. approved invoice
        d = make(priya, "Invoice INV-20418 - Northwind Traders.txt", "invoice", 6)
        approval(d, priya, daniel, "Approved", 5, "Please confirm GST", "Confirmed.")
        set_status(d, "Approved", 4.6)

        # 3. purchase order waiting on Alex
        d = make(priya, "Purchase Order PO-88214 - Control Panels.txt", "po", 1.2)
        approval(d, priya, alex, "Pending", 1.2, "Value is above the ₹5L limit, needs administrator approval")
        set_status(d, "Pending approval", 1.2)

        # 4. signed NDA
        d = make(meera, "Mutual NDA - Brightfield Retail.txt", "nda", 52)
        approval(d, meera, alex, "Approved", 50, "", "Approved for signing.")
        sig(d, meera, "Alex Morgan", "demo@optiva.com", 47, alex)
        conn.execute("INSERT INTO signatures (doc_id, version, signer_name, signer_email, status, typed_name, doc_hash, requested_by, signed_at, created_at) VALUES (?,?,?,?, 'Signed', ?, ?, ?, ?, ?)",
                     (d["id"], d["current_version"], "Neha Kulkarni", "neha.kulkarni@brightfield.example", "Neha Kulkarni",
                      conn.execute("SELECT sha256 FROM document_versions WHERE doc_id=?", (d["id"],)).fetchone()["sha256"], meera["id"], iso(ago(46)), iso(ago(49))))
        log(conn, meera, d, "Signature requested", "From Alex Morgan, Neha Kulkarni", iso(ago(49)))
        log(conn, meera, d, "Signed", "Neha Kulkarni signed v1; all signatures collected", iso(ago(46)))
        set_status(d, "Signed", 46)

        # 5. policy with three versions
        d = make(alex, "Employee Leave Policy 2026.txt", "policy", 80)
        d = add_version(conn, alex, d, "Employee Leave Policy 2026.txt", (_demo_text("policy") + "\nUpdate: carry-forward limited to 5 days.\n").encode(), "Added carry-forward rule", at=ago(40))
        d = add_version(conn, alex, d, "Employee Leave Policy 2026.txt", (_demo_text("policy") + "\nUpdate: carry-forward limited to 5 days.\nUpdate: sick leave increased to 12 days.\n").encode(), "Sick leave update", at=ago(12))
        approval(d, alex, priya, "Approved", 11, "Please review the policy", "Good to publish.")
        set_status(d, "Approved", 10.6)

        # 6. private minutes (only Alex can open)
        d = make(alex, "Q3 Board Meeting Minutes.txt", "minutes", 3, visibility="Private")

        # 7. HR offer shared with Priya only
        d = make(meera, "Offer Letter - Senior Accountant.txt", "offer", 2, visibility="Private")
        conn.execute("INSERT OR REPLACE INTO document_shares (doc_id, email, permission) VALUES (?,?, 'view')", (d["id"], "priya.nair@acme.com"))
        approval(d, meera, alex, "Pending", 2, "Offer for the accounts team")
        set_status(d, "Pending approval", 2)
        log(conn, meera, d, "Access changed", "Visibility: Private; shared with priya.nair@acme.com (view)", iso(ago(2)))

        # 8. revenue report
        d = make(priya, "Q3 Revenue Report.txt", "report", 4)
        approval(d, priya, alex, "Approved", 3.5, "", "Numbers match the ledger.")
        set_status(d, "Approved", 3.2)

        # 9. old checklist close to the end of its retention period
        d = make(daniel, "Warehouse B Safety Checklist 2023.txt", "checklist", 1060)
        conn.execute("UPDATE documents SET retention_policy='ret-general', retention_until=? WHERE id=?", (iso(ago(-38)), d["id"]))

        # 10. draft quotation
        d = make(priya, "Quotation QT-3321 - Cold Chain Sensors.txt", "quote", 0.5)
