"""Optiva ERP API.

Run from the backend folder:   uvicorn app.main:app --reload --port 8000
When frontend/dist exists the same server also serves the built React app.
"""
from __future__ import annotations

import re
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator

from . import erp_data
from .db import connect, init_db
from .deps import current_user, public_user
from .security import create_token, hash_password, verify_password
from .vault import router as vault_router, seed_vault

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_vault()
    yield


app = FastAPI(title="Optiva ERP API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(vault_router)


# ----------------------------------------------------------------- schemas
class SignupIn(BaseModel):
    name: str
    email: str
    company: str
    password: str

    @field_validator("name", "company")
    @classmethod
    def _min_len(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("must be at least 2 characters")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v) < 8 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("use at least 8 characters with letters and numbers")
        return v


class LoginIn(BaseModel):
    email: str
    password: str
    remember: bool = False


class WorkflowPatch(BaseModel):
    status: Literal["Running", "Paused"]


# -------------------------------------------------------------------- auth
@app.post("/api/auth/signup", status_code=201)
def signup(body: SignupIn) -> dict:
    with connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (name, email, company, role, password_hash) VALUES (?, ?, ?, 'Administrator', ?)",
                (body.name, body.email, body.company, hash_password(body.password)),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return {"token": create_token(row["id"]), "user": public_user(row)}


@app.post("/api/auth/login")
def login(body: LoginIn) -> dict:
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (body.email.strip().lower(),)).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return {"token": create_token(row["id"], body.remember), "user": public_user(row)}


@app.get("/api/auth/me")
def me(user: dict = Depends(current_user)) -> dict:
    return user


# --------------------------------------------------------------- dashboard
@app.get("/api/dashboard")
def dashboard(user: dict = Depends(current_user)) -> dict:
    return {
        "kpis": erp_data.kpis(),
        "performance": erp_data.module_performance(),
        "orders": erp_data.orders(),
        "feed": erp_data.feed(),
        "workflows": erp_data.workflows(),
        "insights": erp_data.insights(),
        "addons": erp_data.addons(),
        "notifications": erp_data.notifications(),
    }


@app.get("/api/dashboard/activity")
def dashboard_activity(range: Literal["7d", "30d", "90d"] = Query("30d"), user: dict = Depends(current_user)) -> list[dict]:
    return erp_data.activity(range)


@app.patch("/api/workflows/{workflow_id}")
def patch_workflow(workflow_id: str, body: WorkflowPatch, user: dict = Depends(current_user)) -> dict:
    updated = erp_data.set_workflow_status(workflow_id, body.status)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workflow not found")
    return updated


@app.post("/api/modules/{module_id}/enable")
def enable_module(module_id: str, user: dict = Depends(current_user)) -> dict:
    updated = erp_data.enable_addon(module_id)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    return updated


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# ------------------------------------------------- serve the built React app
if DIST.exists():

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        target = (DIST / path).resolve()
        if path and target.is_file() and DIST in target.parents:
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
