"""Shared request dependencies (kept separate so routers can import them without cycles)."""
from __future__ import annotations

import sqlite3

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import connect
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def public_user(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "name": row["name"], "email": row["email"], "company": row["company"], "role": row["role"]}


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    user_id = decode_token(creds.credentials) if creds else None
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return public_user(row)
