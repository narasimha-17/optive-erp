"""SQLite storage for users and the small amount of mutable demo state."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .security import DATA_DIR, hash_password

DB_PATH = DATA_DIR / "optiva.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    company       TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'Administrator',
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS workflow_state (
    id     TEXT PRIMARY KEY,
    status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS module_state (
    id      TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0
);

-- Vault (document management) ------------------------------------------------
CREATE TABLE IF NOT EXISTS retention_policies (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    years       INTEGER NOT NULL,          -- 0 = keep indefinitely
    action      TEXT NOT NULL,
    description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    filename         TEXT NOT NULL,
    mime             TEXT NOT NULL DEFAULT '',
    size             INTEGER NOT NULL DEFAULT 0,
    doc_type         TEXT NOT NULL DEFAULT 'Other',
    confidence       REAL NOT NULL DEFAULT 0,
    tags             TEXT NOT NULL DEFAULT '[]',
    folder           TEXT NOT NULL DEFAULT 'General',
    status           TEXT NOT NULL DEFAULT 'Draft',
    visibility       TEXT NOT NULL DEFAULT 'Company',
    owner_id         INTEGER NOT NULL REFERENCES users(id),
    company          TEXT NOT NULL,
    retention_policy TEXT,
    retention_until  TEXT,
    legal_hold       INTEGER NOT NULL DEFAULT 0,
    current_version  INTEGER NOT NULL DEFAULT 1,
    text_content     TEXT NOT NULL DEFAULT '',
    extracted        TEXT NOT NULL DEFAULT '{}',
    archived         INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS document_versions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id      TEXT NOT NULL,
    version     INTEGER NOT NULL,
    filename    TEXT NOT NULL,
    size        INTEGER NOT NULL,
    sha256      TEXT NOT NULL,
    path        TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    uploaded_by INTEGER NOT NULL,
    created_at  TEXT NOT NULL,
    UNIQUE (doc_id, version)
);
CREATE TABLE IF NOT EXISTS document_shares (
    doc_id     TEXT NOT NULL,
    email      TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    PRIMARY KEY (doc_id, email)
);
CREATE TABLE IF NOT EXISTS approvals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id       TEXT NOT NULL,
    version      INTEGER NOT NULL,
    requested_by INTEGER NOT NULL,
    approver_id  INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'Pending',
    request_note TEXT NOT NULL DEFAULT '',
    comment      TEXT NOT NULL DEFAULT '',
    decided_at   TEXT,
    created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS signatures (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id       TEXT NOT NULL,
    version      INTEGER NOT NULL,
    signer_name  TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'Pending',
    typed_name   TEXT NOT NULL DEFAULT '',
    drawing      TEXT NOT NULL DEFAULT '',
    doc_hash     TEXT NOT NULL DEFAULT '',
    requested_by INTEGER NOT NULL,
    signed_at    TEXT,
    created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id     TEXT,
    doc_title  TEXT NOT NULL DEFAULT '',
    actor_id   INTEGER,
    actor_name TEXT NOT NULL,
    action     TEXT NOT NULL,
    detail     TEXT NOT NULL DEFAULT '',
    company    TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_company ON documents (company);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_log (company, created_at);
"""

RETENTION_POLICIES = [
    ("ret-finance", "Financial records", 7, "Archive, then review for disposal", "Invoices, ledgers and financial reports are kept for seven years to meet tax and audit requirements."),
    ("ret-contract", "Contracts & agreements", 10, "Archive, then review for disposal", "Executed contracts and NDAs are kept for ten years after signing."),
    ("ret-procurement", "Procurement records", 6, "Archive, then review for disposal", "Purchase orders and supplier correspondence are kept for six years."),
    ("ret-hr", "HR records", 5, "Archive, then review for disposal", "Offer letters and employee records are kept for five years after the last activity."),
    ("ret-governance", "Governance & policy", 10, "Archive, then review for disposal", "Board minutes and company policies are kept for ten years."),
    ("ret-general", "General business", 3, "Archive, then review for disposal", "Everything else is kept for three years."),
    ("ret-hold", "Legal hold", 0, "Keep indefinitely", "Documents under legal hold cannot be deleted or archived until the hold is released."),
]

TEAMMATES = [
    ("Priya Nair", "priya.nair@acme.com", "Finance Manager"),
    ("Daniel Brooks", "daniel.brooks@acme.com", "Operations Head"),
    ("Meera Shah", "meera.shah@acme.com", "Legal Counsel"),
]

DEFAULT_WORKFLOWS = {"wf-invoice": "Running", "wf-po": "Running", "wf-replenish": "Paused"}

DEMO_USER = {
    "name": "Alex Morgan",
    "email": "demo@optiva.com",
    "company": "Acme Corporation",
    "password": "Optiva@123",
}


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        for wid, status in DEFAULT_WORKFLOWS.items():
            conn.execute("INSERT OR IGNORE INTO workflow_state (id, status) VALUES (?, ?)", (wid, status))
        for pid, name, years, action, desc in RETENTION_POLICIES:
            conn.execute(
                "INSERT OR IGNORE INTO retention_policies (id, name, years, action, description) VALUES (?, ?, ?, ?, ?)",
                (pid, name, years, action, desc),
            )
        for name, email, role in TEAMMATES:
            if not conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
                conn.execute(
                    "INSERT INTO users (name, email, company, role, password_hash) VALUES (?, ?, ?, ?, ?)",
                    (name, email, DEMO_USER["company"], role, hash_password(DEMO_USER["password"])),
                )
        exists = conn.execute("SELECT 1 FROM users WHERE email = ?", (DEMO_USER["email"],)).fetchone()
        if not exists:
            conn.execute(
                "INSERT INTO users (name, email, company, role, password_hash) VALUES (?, ?, ?, 'Administrator', ?)",
                (DEMO_USER["name"], DEMO_USER["email"], DEMO_USER["company"], hash_password(DEMO_USER["password"])),
            )
