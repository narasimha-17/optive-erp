"""Password hashing and signed access tokens (stdlib + PyJWT)."""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path

import jwt

DATA_DIR = Path(os.environ.get("OPTIVA_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

ALGORITHM = "HS256"
PBKDF2_ROUNDS = 200_000


def _load_secret() -> str:
    """Use OPTIVA_SECRET if set, otherwise create one once and keep it on disk."""
    env = os.environ.get("OPTIVA_SECRET")
    if env:
        return env
    path = DATA_DIR / ".secret"
    if not path.exists():
        path.write_text(secrets.token_hex(32))
    return path.read_text().strip()


SECRET = _load_secret()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), PBKDF2_ROUNDS)
    return hmac.compare_digest(digest.hex(), digest_hex)


def create_token(user_id: int, remember: bool = False) -> str:
    lifetime = 30 * 24 * 3600 if remember else 12 * 3600
    now = int(time.time())
    return jwt.encode({"sub": str(user_id), "iat": now, "exp": now + lifetime}, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
