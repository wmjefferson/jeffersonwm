import io
import hashlib
import hmac
import json
import mimetypes
import os
import posixpath
import re
import secrets
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

try:
    from PIL import ExifTags, Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

DEFAULT_IMAGE_ROOT = Path(r"E:\images")
LEGACY_IMAGE_ROOT = Path(r"E:\perihelion\images")

ROOT = Path(
    os.environ.get(
        "PERIHELION_IMAGE_ROOT",
        str(DEFAULT_IMAGE_ROOT if DEFAULT_IMAGE_ROOT.exists() else LEGACY_IMAGE_ROOT),
    )
).resolve()
HOST = "0.0.0.0"
PORT = 8010
SHARES_DIR = Path(r"E:\perihelion\shares").resolve()
DATA_DIR = Path(os.environ.get("PERIHELION_DATA_DIR", r"E:\perihelion\data")).resolve()
THUMB_CACHE_DIR = Path(os.environ.get("PERIHELION_THUMB_CACHE_DIR", str(DATA_DIR / "thumb-cache"))).resolve()
DB_PATH = DATA_DIR / "perihelion.sqlite3"
DEFAULT_ORIGIN = "https://jeffersonwm.com"
ALLOWED_ORIGINS = {
    "https://jeffersonwm.com",
    "https://www.jeffersonwm.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}
SESSION_COOKIE_NAME = "perihelion_session"
SESSION_DAYS = int(os.environ.get("PERIHELION_SESSION_DAYS", "30"))
REQUIRE_AUTH = os.environ.get("PERIHELION_REQUIRE_AUTH", "true").lower() in {"1", "true", "yes", "on"}
AUTH_PROVIDER = os.environ.get("PERIHELION_AUTH_PROVIDER", "local").strip().lower()
CENTRAL_AUTH_BASE_URL = os.environ.get("PERIHELION_AUTH_BASE_URL", "https://auth.jeffersonwm.com").rstrip("/")
CENTRAL_AUTH_DB_PATH = Path(
    os.environ.get("PERIHELION_CENTRAL_AUTH_DB_PATH", r"E:\auth-jeffersonwm\backend\data\auth-jeffersonwm.sqlite3")
).resolve()
CENTRAL_SESSION_COOKIE_NAME = os.environ.get("PERIHELION_CENTRAL_SESSION_COOKIE_NAME", "auth_jeffersonwm_session")
REQUIRED_APP_MEMBERSHIP = os.environ.get("PERIHELION_REQUIRED_APP_MEMBERSHIP", "perihelion").strip()
BOOTSTRAP_ADMIN_USERNAME = os.environ.get("PERIHELION_BOOTSTRAP_ADMIN_USERNAME", "").strip()
BOOTSTRAP_ADMIN_PASSWORD = os.environ.get("PERIHELION_BOOTSTRAP_ADMIN_PASSWORD", "")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".tif", ".tiff", ".avif", ".jfif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"}
LARGE_IMAGE_DIMENSION_THRESHOLD = int(os.environ.get("PERIHELION_LARGE_IMAGE_DIMENSION_THRESHOLD", "4096"))
_IMAGE_DIMENSION_CACHE: dict[str, tuple[int | None, int | None]] = {}


def safe_path(rel_path: str) -> Path:
    rel_path = rel_path.replace("\\", "/").strip("/")
    target = (ROOT / rel_path).resolve()
    if target != ROOT and ROOT not in target.parents:
        raise ValueError("Path escapes root")
    return target


def rel_url(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def ensure_shares_dir() -> None:
    SHARES_DIR.mkdir(parents=True, exist_ok=True)


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def ensure_thumb_cache_dir() -> None:
    THUMB_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def make_share_id(length: int = 4) -> str:
    alphabet = "abcdefghkmnpqrtuvwxyz"
    return "".join(__import__("random").choice(alphabet) for _ in range(length))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime | None = None) -> str:
    return (value or utc_now()).isoformat()


def parse_iso(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    return datetime.fromisoformat(normalized)


def load_json_body(handler: BaseHTTPRequestHandler):
    length = int(handler.headers.get("Content-Length", "0"))
    raw = handler.rfile.read(length) if length > 0 else b"{}"
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def guess_kind(ext: str) -> str:
    ext = ext.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in VIDEO_EXTS:
        return "video"
    return "other"


def image_dimensions(file_path: Path) -> tuple[int | None, int | None]:
    if not PIL_AVAILABLE or file_path.suffix.lower() == ".svg":
        return None, None

    try:
        stat = file_path.stat()
        cache_key = f"{file_path}|{stat.st_mtime_ns}|{stat.st_size}"
        cached = _IMAGE_DIMENSION_CACHE.get(cache_key)
        if cached is not None:
            return cached
    except Exception:
        cache_key = None

    try:
        with Image.open(file_path) as img:
            size = img.size
            if cache_key:
                _IMAGE_DIMENSION_CACHE[cache_key] = size
            return size
    except Exception:
        return None, None


def is_large_image_file(file_path: Path) -> bool:
    if guess_kind(file_path.suffix.lower()) != "image":
        return False

    width, height = image_dimensions(file_path)
    if width is None or height is None:
        return False

    return max(width, height) >= LARGE_IMAGE_DIMENSION_THRESHOLD


def visible_name(name: str) -> bool:
    return not name.startswith(".")


def sorted_visible_files(folder: Path) -> list[Path]:
    return sorted(
        [entry for entry in folder.iterdir() if entry.is_file() and visible_name(entry.name)],
        key=lambda p: p.name.lower(),
    )


def folder_preview(folder: Path) -> dict:
    files = sorted_visible_files(folder)
    first = files[0] if files else None
    first_image = next((entry for entry in files if guess_kind(entry.suffix.lower()) == "image"), None)
    return {
        "thumbnailPath": rel_url(first) if first else None,
        "thumbnailKind": guess_kind(first.suffix) if first else None,
        "thumbnailExt": first.suffix.lower() if first else "",
        "imageThumbnailPath": rel_url(first_image) if first_image else None,
        "imageThumbnailKind": guess_kind(first_image.suffix) if first_image else None,
        "imageThumbnailExt": first_image.suffix.lower() if first_image else "",
        "itemCount": len(files),
    }


def resolve_origin(handler: BaseHTTPRequestHandler) -> str:
    origin = handler.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        return origin
    return DEFAULT_ORIGIN


def send_cors_headers(handler: BaseHTTPRequestHandler) -> None:
    handler.send_header("Access-Control-Allow-Origin", resolve_origin(handler))
    handler.send_header("Access-Control-Allow-Credentials", "true")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Vary", "Origin")


def file_response_headers(handler: BaseHTTPRequestHandler, ctype: str, size: int, filename: str | None = None):
    handler.send_response(200)
    handler.send_header("Content-Type", ctype)
    handler.send_header("Content-Length", str(size))
    send_cors_headers(handler)
    if filename:
        quoted = filename.replace('"', "")
        handler.send_header("Content-Disposition", f'attachment; filename="{quoted}"')


def db_connect() -> sqlite3.Connection:
    ensure_data_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with db_connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                is_approved INTEGER NOT NULL DEFAULT 0,
                is_blocked INTEGER NOT NULL DEFAULT 0,
                request_note TEXT,
                created_at TEXT NOT NULL,
                approved_at TEXT,
                blocked_at TEXT
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS download_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username_snapshot TEXT,
                action TEXT NOT NULL,
                file_path TEXT NOT NULL,
                output_name TEXT,
                source_ip TEXT,
                user_agent TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS image_details (
                path TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                tags_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL
            );
            """
        )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "is_blocked" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0")
        if "request_note" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN request_note TEXT")
        if "blocked_at" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN blocked_at TEXT")
        conn.commit()


def normalize_tags(value) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    result: list[str] = []
    for item in value:
        tag = str(item or "").strip().lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        result.append(tag)
    return result


def serialize_image_detail_row(row: sqlite3.Row | None) -> dict:
    if not row:
        return {"title": "", "description": "", "tags": []}
    try:
        tags = normalize_tags(json.loads(row["tags_json"] or "[]"))
    except Exception:
        tags = []
    return {
        "title": row["title"] or "",
        "description": row["description"] or "",
        "tags": tags,
    }


def get_image_detail_record(rel_path: str) -> dict:
    with db_connect() as conn:
        row = conn.execute(
            "SELECT path, title, description, tags_json, updated_at FROM image_details WHERE path = ?",
            (rel_path,),
        ).fetchone()
    return serialize_image_detail_row(row)


def save_image_detail_record(rel_path: str, title: str, description: str, tags: list[str]) -> dict:
    payload = {
        "title": str(title or "").strip(),
        "description": str(description or "").strip(),
        "tags": normalize_tags(tags),
    }
    with db_connect() as conn:
        conn.execute(
            """
            INSERT INTO image_details (path, title, description, tags_json, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                tags_json = excluded.tags_json,
                updated_at = excluded.updated_at
            """,
            (rel_path, payload["title"], payload["description"], json.dumps(payload["tags"], ensure_ascii=False), iso_utc()),
        )
        conn.commit()
    return payload


def load_image_details_map(paths: list[str]) -> dict[str, dict]:
    if not paths:
        return {}
    placeholders = ",".join("?" for _ in paths)
    with db_connect() as conn:
        rows = conn.execute(
            f"SELECT path, title, description, tags_json, updated_at FROM image_details WHERE path IN ({placeholders})",
            tuple(paths),
        ).fetchall()
    return {row["path"]: serialize_image_detail_row(row) for row in rows}


def collect_tag_stats() -> tuple[list[str], dict[str, int]]:
    counts: dict[str, int] = {}
    with db_connect() as conn:
        rows = conn.execute("SELECT tags_json FROM image_details").fetchall()
    for row in rows:
        try:
            tags = normalize_tags(json.loads(row["tags_json"] or "[]"))
        except Exception:
            tags = []
        for tag in tags:
            counts[tag] = counts.get(tag, 0) + 1
    tags = sorted(counts.keys())
    return tags, counts


def rewrite_tags(transform) -> None:
    with db_connect() as conn:
        rows = conn.execute("SELECT path, title, description, tags_json FROM image_details").fetchall()
        now = iso_utc()
        for row in rows:
            try:
                current_tags = normalize_tags(json.loads(row["tags_json"] or "[]"))
            except Exception:
                current_tags = []
            next_tags = normalize_tags(transform(current_tags))
            if next_tags == current_tags:
                continue
            conn.execute(
                "UPDATE image_details SET tags_json = ?, updated_at = ? WHERE path = ?",
                (json.dumps(next_tags, ensure_ascii=False), now, row["path"]),
            )
        conn.commit()


def rename_tag_globally(old_tag: str, new_tag: str) -> None:
    old_tag = old_tag.strip().lower()
    new_tag = new_tag.strip().lower()
    if not old_tag or not new_tag:
        return

    def transform(tags: list[str]) -> list[str]:
        return [new_tag if tag == old_tag else tag for tag in tags]

    rewrite_tags(transform)


def delete_tag_globally(tag_name: str) -> None:
    tag_name = tag_name.strip().lower()
    if not tag_name:
        return

    def transform(tags: list[str]) -> list[str]:
        return [tag for tag in tags if tag != tag_name]

    rewrite_tags(transform)


def bulk_update_tags(image_paths: list[str], tag_name: str, action: str) -> None:
    clean_tag = tag_name.strip().lower()
    if not clean_tag or action not in {"add", "remove"}:
        return
    unique_paths = [path for path in dict.fromkeys(str(path or "").strip() for path in image_paths) if path]
    if not unique_paths:
        return

    with db_connect() as conn:
        now = iso_utc()
        for rel_path in unique_paths:
            row = conn.execute(
                "SELECT path, title, description, tags_json FROM image_details WHERE path = ?",
                (rel_path,),
            ).fetchone()
            current = serialize_image_detail_row(row)
            tags = current["tags"]
            if action == "add":
                next_tags = normalize_tags(tags + [clean_tag])
            else:
                next_tags = [tag for tag in tags if tag != clean_tag]
            conn.execute(
                """
                INSERT INTO image_details (path, title, description, tags_json, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    tags_json = excluded.tags_json,
                    updated_at = excluded.updated_at
                """,
                (
                    rel_path,
                    current["title"],
                    current["description"],
                    json.dumps(next_tags, ensure_ascii=False),
                    now,
                ),
            )
        conn.commit()


def load_share_record(share_id: str) -> dict | None:
    share_file = SHARES_DIR / f"{share_id}.json"
    if not share_file.is_file():
        return None
    data = json.loads(share_file.read_text(encoding="utf-8"))
    images = data.get("images") or []
    data["images"] = [str(path or "").strip() for path in images if str(path or "").strip()]
    data["itemCount"] = len(data["images"])
    files = []
    missing_images = []
    for rel_path in data["images"]:
        info = {
            "path": rel_path,
            "name": Path(rel_path).name,
            "kind": guess_kind(Path(rel_path).suffix.lower()),
            "is_large": False,
            "size": 0,
            "missing": False,
        }
        try:
            target = safe_path(rel_path)
            if target.is_file():
                info["size"] = target.stat().st_size
                info["is_large"] = is_large_image_file(target)
            else:
                info["missing"] = True
                missing_images.append(rel_path)
        except Exception:
            info["missing"] = True
            missing_images.append(rel_path)
        files.append(info)
    data["files"] = files
    data["missingImages"] = missing_images
    return data


def list_share_records() -> list[dict]:
    ensure_shares_dir()
    shares: list[dict] = []
    for share_file in SHARES_DIR.glob("*.json"):
        try:
            data = json.loads(share_file.read_text(encoding="utf-8"))
        except Exception:
            continue
        images = [str(path or "").strip() for path in (data.get("images") or []) if str(path or "").strip()]
        shares.append(
            {
                "id": data.get("id") or share_file.stem,
                "title": (data.get("title") or "").strip(),
                "images": images,
                "itemCount": len(images),
                "created_at": data.get("created_at") or "",
            }
        )
    shares.sort(key=lambda share: share.get("created_at") or "", reverse=True)
    return shares


def save_share_record(share_id: str, title: str, images: list[str], created_at: str | None = None) -> dict:
    ensure_shares_dir()
    payload = {
        "id": share_id,
        "title": (title or "").strip(),
        "images": [str(path or "").strip() for path in images if str(path or "").strip()],
        "created_at": created_at or iso_utc(),
    }
    share_file = SHARES_DIR / f"{share_id}.json"
    share_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    payload["itemCount"] = len(payload["images"])
    return payload


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    iterations = 310000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        ).hex()
        return hmac.compare_digest(digest, expected)
    except Exception:
        return False


def create_user(
    conn: sqlite3.Connection,
    username: str,
    password: str,
    *,
    is_admin: bool,
    is_approved: bool,
    request_note: str | None = None,
) -> int:
    now = iso_utc()
    approved_at = now if is_approved else None
    cursor = conn.execute(
        """
        INSERT INTO users (username, password_hash, is_admin, is_approved, is_blocked, request_note, created_at, approved_at, blocked_at)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)
        """,
        (username, hash_password(password), int(is_admin), int(is_approved), request_note, now, approved_at),
    )
    return int(cursor.lastrowid)


def bootstrap_admin_if_needed() -> None:
    if not BOOTSTRAP_ADMIN_USERNAME or not BOOTSTRAP_ADMIN_PASSWORD:
        return

    with db_connect() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (BOOTSTRAP_ADMIN_USERNAME,)).fetchone()
        if existing:
            return
        create_user(
            conn,
            BOOTSTRAP_ADMIN_USERNAME,
            BOOTSTRAP_ADMIN_PASSWORD,
            is_admin=True,
            is_approved=True,
            request_note="Bootstrap admin account",
        )
        conn.commit()


def cookie_map(handler: BaseHTTPRequestHandler) -> dict[str, str]:
    header = handler.headers.get("Cookie", "")
    cookies: dict[str, str] = {}
    if not header:
        return cookies
    for part in header.split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        cookies[key.strip()] = value.strip()
    return cookies


def serialize_user(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    raw_id = row["id"]
    try:
        user_id: int | str = int(raw_id)
    except (TypeError, ValueError):
        user_id = str(raw_id)
    return {
        "id": user_id,
        "username": row["username"],
        "isAdmin": bool(row["is_admin"]),
        "isApproved": bool(row["is_approved"]),
        "isBlocked": bool(row["is_blocked"]),
        "requestNote": row["request_note"],
        "createdAt": row["created_at"],
        "approvedAt": row["approved_at"],
        "blockedAt": row["blocked_at"],
    }


def central_auth_enabled() -> bool:
    return AUTH_PROVIDER == "central"


def central_auth_db_connect() -> sqlite3.Connection | None:
    if not CENTRAL_AUTH_DB_PATH.is_file():
        return None
    conn = sqlite3.connect(CENTRAL_AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def central_membership_granted(conn: sqlite3.Connection, user_id: int | str, app_key: str) -> bool:
    if not app_key:
        return True
    row = conn.execute(
        """
        SELECT 1
        FROM user_app_memberships
        WHERE user_id = ? AND app_key = ?
        """,
        (str(user_id), app_key),
    ).fetchone()
    return bool(row)


def current_local_user_from_handler(handler: BaseHTTPRequestHandler) -> dict | None:
    token = cookie_map(handler).get(SESSION_COOKIE_NAME)
    if not token:
        return None

    with db_connect() as conn:
        row = conn.execute(
            """
            SELECT users.id, users.username, users.is_admin, users.is_approved, users.is_blocked, users.request_note,
                   users.created_at, users.approved_at, users.blocked_at,
                   sessions.token, sessions.expires_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()

        if not row:
            return None

        expires_at = parse_iso(row["expires_at"])
        if expires_at <= utc_now():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return None

        conn.execute("UPDATE sessions SET last_seen_at = ? WHERE token = ?", (iso_utc(), token))
        conn.commit()
        return serialize_user(row)


def current_central_user_from_handler(handler: BaseHTTPRequestHandler) -> dict | None:
    token = cookie_map(handler).get(CENTRAL_SESSION_COOKIE_NAME)
    if not token:
        return None

    conn = central_auth_db_connect()
    if not conn:
        return None

    with conn:
        row = conn.execute(
            """
            SELECT users.id, users.username, users.is_admin, users.is_approved, users.is_blocked, users.request_note,
                   users.created_at, users.approved_at, users.blocked_at,
                   sessions.token, sessions.expires_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()

        if not row:
            return None

        expires_at = parse_iso(row["expires_at"])
        if expires_at <= utc_now():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            return None

        if row["is_blocked"] or not row["is_approved"]:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            return None

        if not central_membership_granted(conn, row["id"], REQUIRED_APP_MEMBERSHIP):
            return None

        conn.execute("UPDATE sessions SET last_seen_at = ? WHERE token = ?", (iso_utc(), token))
        return serialize_user(row)


def current_user_from_handler(handler: BaseHTTPRequestHandler) -> dict | None:
    if central_auth_enabled():
        return current_central_user_from_handler(handler)
    return current_local_user_from_handler(handler)


def create_session(user_id: int) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    now = utc_now()
    expires_at = now + timedelta(days=SESSION_DAYS)
    with db_connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions (token, user_id, created_at, expires_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (token, user_id, iso_utc(now), iso_utc(expires_at), iso_utc(now)),
        )
        conn.commit()
    return token, expires_at


def destroy_session(token: str | None) -> None:
    if not token:
        return
    with db_connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


def count_users() -> int:
    if central_auth_enabled():
        conn = central_auth_db_connect()
        if not conn:
            return 0
        with conn:
            row = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()
            return int(row["count"]) if row else 0
    with db_connect() as conn:
        row = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()
        return int(row["count"]) if row else 0


def count_approved_admins() -> int:
    with db_connect() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM users
            WHERE is_admin = 1 AND is_approved = 1
            """
        ).fetchone()
        return int(row["count"]) if row else 0


def is_last_approved_admin(user_id: int) -> bool:
    with db_connect() as conn:
        row = conn.execute(
            """
            SELECT id
            FROM users
            WHERE id = ? AND is_admin = 1 AND is_approved = 1 AND is_blocked = 0
            """,
            (user_id,),
        ).fetchone()
        if not row:
            return False
        return count_approved_admins() <= 1


def require_access(handler: BaseHTTPRequestHandler) -> dict | None:
    if not REQUIRE_AUTH:
        return current_user_from_handler(handler)
    user = current_user_from_handler(handler)
    if user:
        return user
    handler._send_json({"error": "Authentication required"}, 401)
    return None


def log_download(user: dict | None, action: str, file_path: str, output_name: str | None, handler: BaseHTTPRequestHandler) -> None:
    local_user_id = None
    if user and not central_auth_enabled():
        local_user_id = user["id"]

    with db_connect() as conn:
        conn.execute(
            """
            INSERT INTO download_history
            (user_id, username_snapshot, action, file_path, output_name, source_ip, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                local_user_id,
                user["username"] if user else None,
                action,
                file_path,
                output_name,
                handler.client_address[0] if handler.client_address else None,
                handler.headers.get("User-Agent", ""),
                iso_utc(),
            ),
        )
        conn.commit()

    if central_auth_enabled() and user:
        central_conn = central_auth_db_connect()
        if central_conn:
            with central_conn:
                central_conn.execute(
                    """
                    INSERT INTO history (id, user_id, username_snapshot, action, target, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        secrets.token_hex(16),
                        str(user["id"]),
                        user["username"],
                        f"perihelion.{action}",
                        output_name or file_path,
                        iso_utc(),
                    ),
                )


def image_metadata(file_path: Path):
    size = file_path.stat().st_size
    mime = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    width = None
    height = None
    format_name = None
    mode = None
    frames = None
    orientation = None
    camera_make = None
    camera_model = None
    captured_at = None

    if PIL_AVAILABLE and file_path.suffix.lower() != ".svg":
        try:
            with Image.open(file_path) as img:
                width, height = img.size
                format_name = img.format
                mode = img.mode
                frames = getattr(img, "n_frames", 1)
                exif = {}
                try:
                    raw_exif = img.getexif()
                    if raw_exif:
                        for key, value in raw_exif.items():
                            tag_name = ExifTags.TAGS.get(key, key)
                            exif[tag_name] = value
                except Exception:
                    exif = {}

                orientation = exif.get("Orientation")
                camera_make = exif.get("Make")
                camera_model = exif.get("Model")
                captured_at = exif.get("DateTimeOriginal") or exif.get("DateTime")
        except Exception:
            pass

    return {
        "type": mime,
        "format": format_name or mime,
        "size": size,
        "width": width,
        "height": height,
        "mode": mode,
        "frames": frames,
        "orientation": orientation,
        "cameraMake": camera_make,
        "cameraModel": camera_model,
        "capturedAt": captured_at,
    }


def process_image_bytes(file_path: Path, options: dict) -> bytes:
    if not PIL_AVAILABLE:
        return file_path.read_bytes()

    enable_dimensions = bool(options.get("enableDimensions"))
    enable_filesize = bool(options.get("enableFilesize"))
    dimensions = options.get("dimensions") or {}
    target_kb = options.get("targetFileSizeKB")

    suffix = file_path.suffix.lower()
    if suffix == ".svg":
        return file_path.read_bytes()

    with Image.open(file_path) as img:
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")

        if enable_dimensions:
            width = dimensions.get("width")
            height = dimensions.get("height")
            maintain_aspect = dimensions.get("maintainAspect", True)

            if width or height:
                if maintain_aspect:
                    max_size = (
                        int(width) if width else img.width,
                        int(height) if height else img.height,
                    )
                    img.thumbnail(max_size, Image.Resampling.LANCZOS)
                else:
                    img = img.resize(
                        (
                            int(width) if width else img.width,
                            int(height) if height else img.height,
                        ),
                        Image.Resampling.LANCZOS,
                    )

        out = io.BytesIO()
        save_format = "JPEG" if suffix in {".jpg", ".jpeg", ".jfif"} else (img.format or "PNG")

        if enable_filesize and target_kb and save_format.upper() in {"JPEG", "WEBP"}:
            quality = 85
            best = None
            while quality >= 20:
                trial = io.BytesIO()
                img.save(trial, format=save_format, quality=quality, optimize=True)
                data = trial.getvalue()
                best = data
                if len(data) <= int(target_kb) * 1024:
                    return data
                quality -= 10
            return best or file_path.read_bytes()

        save_kwargs = {"format": save_format}
        if save_format.upper() in {"JPEG", "WEBP"}:
            save_kwargs["quality"] = 90
            save_kwargs["optimize"] = True

        img.save(out, **save_kwargs)
        return out.getvalue()


def parse_thumb_dimension(raw_value: str | None, fallback: int) -> int:
    try:
        value = int(str(raw_value or "").strip())
    except (TypeError, ValueError):
        return fallback
    return max(32, min(2400, value))


def thumb_cache_path(rel_path: str, width: int, height: int, source_stamp: str) -> Path:
    ext = Path(rel_path).suffix.lower() or ".img"
    digest = hashlib.sha1(f"{rel_path}|{width}|{height}|contain|{source_stamp}".encode("utf-8")).hexdigest()
    return THUMB_CACHE_DIR / digest[:2] / f"{digest}{ext}"


def write_bytes_atomic(target: Path, data: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=target.parent) as temp:
        temp.write(data)
        temp_path = Path(temp.name)
    os.replace(temp_path, target)


def cached_thumbnail_path(source: Path, rel_path: str, width: int, height: int) -> Path:
    source_stat = source.stat()
    source_stamp = f"{source_stat.st_mtime_ns}-{source_stat.st_size}"
    cache_path = thumb_cache_path(rel_path, width, height, source_stamp)
    if cache_path.is_file():
        return cache_path

    options = {
        "enableDimensions": True,
        "dimensions": {
            "width": width,
            "height": height,
            "maintainAspect": True,
        },
        "enableFilesize": False,
    }
    thumb_bytes = process_image_bytes(source, options)
    write_bytes_atomic(cache_path, thumb_bytes)
    os.utime(cache_path, ns=(source_stat.st_atime_ns, source_stat.st_mtime_ns))
    return cache_path


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200, extra_headers: list[tuple[str, str]] | None = None):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        send_cors_headers(self)
        for key, value in extra_headers or []:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, file_path: Path, download_name: str | None = None):
        if not file_path.is_file():
            self._send_json({"error": "File not found"}, 404)
            return

        ctype, _ = mimetypes.guess_type(str(file_path))
        ctype = ctype or "application/octet-stream"
        size = file_path.stat().st_size
        file_response_headers(self, ctype, size, download_name)
        self.end_headers()

        with open(file_path, "rb") as f:
            shutil.copyfileobj(f, self.wfile)

    def _send_thumbnail(self, source_path: Path, rel_path: str, query: dict[str, list[str]]):
        if not source_path.is_file():
            self._send_json({"error": "File not found"}, 404)
            return

        if guess_kind(source_path.suffix) != "image":
            self._send_file(source_path)
            return

        width = parse_thumb_dimension((query.get("w") or [None])[0], 500)
        height = parse_thumb_dimension((query.get("h") or [None])[0], 250)

        try:
            if not PIL_AVAILABLE or source_path.suffix.lower() == ".svg":
                self._send_file(source_path)
                return

            thumb_path = cached_thumbnail_path(source_path, rel_path, width, height)
            ctype, _ = mimetypes.guess_type(str(thumb_path))
            ctype = ctype or "application/octet-stream"
            size = thumb_path.stat().st_size
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            send_cors_headers(self)
            self.end_headers()

            with open(thumb_path, "rb") as f:
                shutil.copyfileobj(f, self.wfile)
        except Exception:
            self._send_file(source_path)

    def _set_session_cookie(self, token: str, expires_at: datetime) -> tuple[str, str]:
        expires_text = expires_at.strftime("%a, %d %b %Y %H:%M:%S GMT")
        return (
            "Set-Cookie",
            f"{SESSION_COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires={expires_text}",
        )

    def _clear_session_cookie(self) -> tuple[str, str]:
        return (
            "Set-Cookie",
            f"{SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        )

    def _require_admin(self) -> dict | None:
        user = current_user_from_handler(self)
        if not user:
            self._send_json({"error": "Authentication required"}, 401)
            return None
        if not user["isAdmin"]:
            self._send_json({"error": "Admin access required"}, 403)
            return None
        return user

    def do_OPTIONS(self):
        self.send_response(204)
        send_cors_headers(self)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        try:
            if path == "/api/auth/status":
                user = current_user_from_handler(self)
                self._send_json({
                    "ok": True,
                    "user": user,
                    "requireAuth": REQUIRE_AUTH,
                    "hasUsers": count_users() > 0,
                    "provider": AUTH_PROVIDER,
                    "authBaseUrl": CENTRAL_AUTH_BASE_URL if central_auth_enabled() else None,
                    "requiredAppMembership": REQUIRED_APP_MEMBERSHIP if central_auth_enabled() else None,
                })
                return

            if path == "/api/history/downloads":
                if central_auth_enabled():
                    self._send_json({"error": "Download history now lives in Multimillion.", "authBaseUrl": CENTRAL_AUTH_BASE_URL}, 409)
                    return
                user = current_user_from_handler(self)
                if not user:
                    self._send_json({"error": "Authentication required"}, 401)
                    return

                limit = max(1, min(200, int(query.get("limit", ["50"])[0])))
                with db_connect() as conn:
                    if user["isAdmin"] and query.get("all", ["0"])[0] in {"1", "true"}:
                        rows = conn.execute(
                            """
                            SELECT id, user_id, username_snapshot, action, file_path, output_name, source_ip, user_agent, created_at
                            FROM download_history
                            ORDER BY created_at DESC
                            LIMIT ?
                            """,
                            (limit,),
                        ).fetchall()
                    else:
                        rows = conn.execute(
                            """
                            SELECT id, user_id, username_snapshot, action, file_path, output_name, source_ip, user_agent, created_at
                            FROM download_history
                            WHERE user_id = ?
                            ORDER BY created_at DESC
                            LIMIT ?
                            """,
                            (user["id"], limit),
                        ).fetchall()

                history = [dict(row) for row in rows]
                self._send_json({"ok": True, "history": history})
                return

            if path == "/api/admin/users":
                if central_auth_enabled():
                    self._send_json({"error": "Account administration now lives in Multimillion.", "authBaseUrl": CENTRAL_AUTH_BASE_URL}, 409)
                    return
                user = self._require_admin()
                if not user:
                    return

                with db_connect() as conn:
                    rows = conn.execute(
                        """
                        SELECT id, username, is_admin, is_approved, is_blocked, request_note, created_at, approved_at, blocked_at
                        FROM users
                        ORDER BY is_approved ASC, is_blocked ASC, created_at DESC
                        """
                    ).fetchall()
                self._send_json({"ok": True, "users": [serialize_user(row) for row in rows]})
                return

            if path in ("/api/list", "/api/images"):
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                rel = unquote(query.get("path", [""])[0])
                current = safe_path(rel)
                if not current.exists() or not current.is_dir():
                    self._send_json({"error": "Folder not found"}, 404)
                    return
                tag_filter = (query.get("tag", [""])[0] or "").strip().lower()
                share_filter = (query.get("list", [""])[0] or "").strip()
                search_filter = (query.get("search", [""])[0] or "").strip().lower()
                page = max(1, int(query.get("page", ["1"])[0]))
                limit = max(1, min(250, int(query.get("limit", ["25"])[0])))

                folders = []
                files = []
                for entry in sorted(current.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                    item = {
                        "name": entry.name,
                        "path": rel_url(entry),
                        "modified": int(entry.stat().st_mtime),
                    }
                    if entry.is_dir():
                        item["type"] = "directory"
                        item.update(folder_preview(entry))
                        folders.append(item)
                    else:
                        ext = entry.suffix.lower()
                        item["type"] = "file"
                        item["ext"] = ext
                        item["size"] = entry.stat().st_size
                        item["kind"] = guess_kind(ext)
                        item["is_large"] = is_large_image_file(entry)
                        item["url"] = f"/images/{rel_url(entry)}"
                        files.append(item)

                detail_map = load_image_details_map([file["path"] for file in files])
                share_image_set: set[str] | None = None
                if share_filter:
                    share = load_share_record(share_filter)
                    if not share:
                        self._send_json({"error": "Shared page not found"}, 404)
                        return
                    share_image_set = set(share["images"])

                enriched_files = []
                for item in files:
                    detail = detail_map.get(item["path"], {"title": "", "description": "", "tags": []})
                    item["title"] = detail["title"]
                    item["description"] = detail["description"]
                    item["tags"] = detail["tags"]
                    if share_image_set is not None and item["path"] not in share_image_set:
                        continue
                    if tag_filter and tag_filter not in item["tags"]:
                        continue
                    if search_filter:
                        haystack = " ".join(
                            [
                                item.get("name", ""),
                                item.get("path", ""),
                                item.get("title", ""),
                                item.get("description", ""),
                                " ".join(item.get("tags", [])),
                            ]
                        ).lower()
                        if search_filter not in haystack:
                            continue
                    enriched_files.append(item)
                files = enriched_files

                breadcrumbs = []
                if rel:
                    acc = []
                    for part in rel.split("/"):
                        acc.append(part)
                        breadcrumbs.append({"name": part, "path": "/".join(acc)})

                image_files = [f["path"] for f in files if f["kind"] == "image"]
                directory_paths = [f["path"] for f in folders]
                total = len(files)
                start = (page - 1) * limit
                end = start + limit
                paged_files = files[start:end]
                total_pages = max(1, (total + limit - 1) // limit)

                self._send_json({
                    "root": ROOT.as_posix(),
                    "current": rel,
                    "folders": folders,
                    "files": paged_files,
                    "breadcrumbs": breadcrumbs,
                    "counts": {
                        "folders": len(folders),
                        "files": total,
                        "images": len(image_files),
                        "other": sum(1 for f in files if f["kind"] != "image"),
                    },
                    "images": image_files,
                    "directories": directory_paths,
                    "page": page,
                    "totalPages": total_pages,
                    "total": total,
                })
                return

            if path.startswith("/images/") or path.startswith("/media/"):
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                prefix = "/images/" if path.startswith("/images/") else "/media/"
                rel = unquote(path[len(prefix):])
                target = safe_path(rel)
                self._send_file(target)
                return

            if path.startswith("/thumbs/"):
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                rel = unquote(path[len("/thumbs/"):])
                target = safe_path(rel)
                self._send_thumbnail(target, rel, query)
                return

            if path.startswith("/api/image-meta/"):
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                rel = unquote(path[len("/api/image-meta/"):])
                target = safe_path(rel)
                if not target.is_file():
                    self._send_json({"error": "File not found"}, 404)
                    return
                self._send_json(image_metadata(target))
                return

            if path.startswith("/api/image-details/"):
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                rel = unquote(path[len("/api/image-details/"):])
                target = safe_path(rel)
                if not target.is_file():
                    self._send_json({"error": "File not found"}, 404)
                    return
                detail = get_image_detail_record(rel)
                self._send_json({
                    "ok": True,
                    "path": rel,
                    "title": detail["title"],
                    "description": detail["description"],
                    "tags": detail["tags"],
                    "exif": image_metadata(target),
                })
                return

            if path == "/api/tags":
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                tags, tag_counts = collect_tag_stats()
                self._send_json({"ok": True, "tags": tags, "tagCounts": tag_counts})
                return

            if path == "/api/shares":
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                self._send_json({"ok": True, "shares": list_share_records()})
                return

            if path.startswith("/api/download/"):
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                rel = unquote(path[len("/api/download/"):])
                target = safe_path(rel)
                log_download(user, "single", rel_url(target), Path(rel).name, self)
                self._send_file(target, Path(rel).name)
                return

            if path.startswith("/api/share/"):
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                share_id = unquote(path[len("/api/share/"):]).strip("/")
                share = load_share_record(share_id)
                if not share:
                    self._send_json({"error": "Shared page not found"}, 404)
                    return
                self._send_json(share)
                return

            if path == "/" or path == "/index.html":
                html = """<!doctype html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Perihelion API</title>
                <style>
                :root { color-scheme: light; }
                body {
                    margin: 0;
                    min-height: 100vh;
                    display: grid;
                    place-items: center;
                    background: #f3f4f6;
                    color: #111827;
                    font: 16px/1.5 "Segoe UI", Arial, sans-serif;
                }
                main {
                    width: min(560px, calc(100vw - 48px));
                    padding: 28px 32px;
                    border: 1px solid #d1d5db;
                    background: #ffffff;
                    box-shadow: 0 12px 28px rgba(17, 24, 39, 0.08);
                }
                h1 {
                    margin: 0 0 8px;
                    font-size: 28px;
                }
                p {
                    margin: 0 0 16px;
                }
                code {
                    display: inline-block;
                    padding: 2px 6px;
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                }
                ul {
                    margin: 0;
                    padding-left: 18px;
                }
                </style>
            </head>
            <body>
                <main>
                <h1>Perihelion API</h1>
                <p>The image service is running.</p>
                <ul>
                    <li><code>/api/images</code> returns the image feed</li>
                    <li><code>/api/share/&lt;id&gt;</code> returns saved shared pages</li>
                    <li><code>/images/&lt;path&gt;</code> serves image files</li>
                </ul>
                </main>
            </body>
            </html>""".encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(html)))
                send_cors_headers(self)
                self.end_headers()
                self.wfile.write(html)
                return

            self._send_json({"error": "Not found"}, 404)

        except ValueError:
            self._send_json({"error": "Invalid path"}, 400)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            if path == "/api/auth/register":
                if central_auth_enabled():
                    self._send_json({"error": "Registration is handled by Multimillion.", "authBaseUrl": CENTRAL_AUTH_BASE_URL}, 409)
                    return
                payload = load_json_body(self)
                username = (payload.get("username") or "").strip()
                password = payload.get("password") or ""
                request_note = (payload.get("requestNote") or "").strip()

                if not re.fullmatch(r"[A-Za-z0-9_.-]{3,32}", username):
                    self._send_json({"error": "Username must be 3-32 characters using letters, numbers, dots, dashes, or underscores"}, 400)
                    return
                if len(password) < 8:
                    self._send_json({"error": "Password must be at least 8 characters"}, 400)
                    return
                if len(request_note) < 12:
                    self._send_json({"error": "Please include a short note about who you are or why you are requesting access"}, 400)
                    return

                first_user = count_approved_admins() == 0
                try:
                    with db_connect() as conn:
                        user_id = create_user(
                            conn,
                            username,
                            password,
                            is_admin=first_user,
                            is_approved=first_user,
                            request_note=request_note,
                        )
                        conn.commit()
                except sqlite3.IntegrityError:
                    self._send_json({"error": "That username is already taken"}, 409)
                    return

                self._send_json({
                    "ok": True,
                    "userId": user_id,
                    "isAdmin": first_user,
                    "isApproved": first_user,
                    "needsApproval": not first_user,
                }, 201)
                return

            if path == "/api/auth/login":
                if central_auth_enabled():
                    self._send_json({"error": "Sign-in is handled by Multimillion.", "authBaseUrl": CENTRAL_AUTH_BASE_URL}, 409)
                    return
                payload = load_json_body(self)
                username = (payload.get("username") or "").strip()
                password = payload.get("password") or ""

                with db_connect() as conn:
                    row = conn.execute(
                        """
                        SELECT id, username, password_hash, is_admin, is_approved, is_blocked, request_note, created_at, approved_at, blocked_at
                        FROM users
                        WHERE username = ?
                        """,
                        (username,),
                    ).fetchone()

                if not row or not verify_password(password, row["password_hash"]):
                    self._send_json({"error": "Invalid username or password"}, 401)
                    return
                if row["is_blocked"]:
                    self._send_json({"error": "Account blocked. Please contact the administrator."}, 403)
                    return
                if not row["is_approved"]:
                    self._send_json({"error": "Account pending approval"}, 403)
                    return

                token, expires_at = create_session(int(row["id"]))
                self._send_json(
                    {"ok": True, "user": serialize_user(row)},
                    200,
                    extra_headers=[self._set_session_cookie(token, expires_at)],
                )
                return

            if path == "/api/auth/logout":
                if central_auth_enabled():
                    self._send_json({"error": "Sign-out is handled by Multimillion.", "authBaseUrl": CENTRAL_AUTH_BASE_URL}, 409)
                    return
                destroy_session(cookie_map(self).get(SESSION_COOKIE_NAME))
                self._send_json({"ok": True}, 200, extra_headers=[self._clear_session_cookie()])
                return

            if path == "/api/auth/change-password":
                if central_auth_enabled():
                    self._send_json({"error": "Password changes are handled by Multimillion.", "authBaseUrl": CENTRAL_AUTH_BASE_URL}, 409)
                    return
                user = current_user_from_handler(self)
                if not user:
                    self._send_json({"error": "Authentication required"}, 401)
                    return

                payload = load_json_body(self)
                current_password = payload.get("currentPassword") or ""
                new_password = payload.get("newPassword") or ""

                if len(new_password) < 8:
                    self._send_json({"error": "New password must be at least 8 characters"}, 400)
                    return

                with db_connect() as conn:
                    row = conn.execute(
                        """
                        SELECT id, password_hash
                        FROM users
                        WHERE id = ?
                        """,
                        (user["id"],),
                    ).fetchone()

                    if not row or not verify_password(current_password, row["password_hash"]):
                        self._send_json({"error": "Current password is incorrect"}, 401)
                        return

                    conn.execute(
                        "UPDATE users SET password_hash = ? WHERE id = ?",
                        (hash_password(new_password), user["id"]),
                    )
                    conn.commit()

                self._send_json({"ok": True})
                return

            if path == "/api/auth/change-username":
                if central_auth_enabled():
                    self._send_json({"error": "Username changes are handled by Multimillion.", "authBaseUrl": CENTRAL_AUTH_BASE_URL}, 409)
                    return
                user = current_user_from_handler(self)
                if not user:
                    self._send_json({"error": "Authentication required"}, 401)
                    return

                payload = load_json_body(self)
                current_password = payload.get("currentPassword") or ""
                new_username = (payload.get("newUsername") or "").strip()

                if not re.fullmatch(r"[A-Za-z0-9_.-]{3,32}", new_username):
                    self._send_json({"error": "Username must be 3-32 characters using letters, numbers, dots, dashes, or underscores"}, 400)
                    return

                with db_connect() as conn:
                    row = conn.execute(
                        """
                        SELECT id, username, password_hash, is_admin, is_approved, is_blocked, request_note, created_at, approved_at, blocked_at
                        FROM users
                        WHERE id = ?
                        """,
                        (user["id"],),
                    ).fetchone()

                    if not row or not verify_password(current_password, row["password_hash"]):
                        self._send_json({"error": "Current password is incorrect"}, 401)
                        return

                    try:
                        conn.execute(
                            "UPDATE users SET username = ? WHERE id = ?",
                            (new_username, user["id"]),
                        )
                        conn.commit()
                    except sqlite3.IntegrityError:
                        self._send_json({"error": "That username is already taken"}, 409)
                        return

                    updated = conn.execute(
                        """
                        SELECT id, username, is_admin, is_approved, is_blocked, request_note, created_at, approved_at, blocked_at
                        FROM users
                        WHERE id = ?
                        """,
                        (user["id"],),
                    ).fetchone()

                self._send_json({"ok": True, "user": serialize_user(updated)})
                return

            match = re.fullmatch(r"/api/admin/users/(\d+)/(approve|block|delete)", path)
            if match:
                if central_auth_enabled():
                    self._send_json({"error": "Account administration now lives in Multimillion.", "authBaseUrl": CENTRAL_AUTH_BASE_URL}, 409)
                    return
                admin = self._require_admin()
                if not admin:
                    return

                user_id = int(match.group(1))
                action = match.group(2)
                if action in {"block", "delete"} and is_last_approved_admin(user_id):
                    self._send_json({"error": "You cannot remove the last approved admin account"}, 400)
                    return
                with db_connect() as conn:
                    if action == "approve":
                        conn.execute(
                            "UPDATE users SET is_approved = 1, is_blocked = 0, approved_at = ?, blocked_at = NULL WHERE id = ?",
                            (iso_utc(), user_id),
                        )
                    elif action == "block":
                        conn.execute(
                            "UPDATE users SET is_approved = 0, is_blocked = 1, approved_at = NULL, blocked_at = ? WHERE id = ?",
                            (iso_utc(), user_id),
                        )
                        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
                    else:
                        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
                        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
                    conn.commit()

                self._send_json({"ok": True, "action": action, "userId": user_id})
                return

            if path.startswith("/api/image-details/"):
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                rel = unquote(path[len("/api/image-details/"):])
                target = safe_path(rel)
                if not target.is_file():
                    self._send_json({"error": "File not found"}, 404)
                    return
                payload = load_json_body(self)
                detail = save_image_detail_record(
                    rel,
                    payload.get("title") or "",
                    payload.get("description") or "",
                    payload.get("tags") or [],
                )
                self._send_json({"ok": True, "path": rel, **detail})
                return

            if path == "/api/bulk-tags":
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                payload = load_json_body(self)
                images = payload.get("images") or []
                tag = payload.get("tag") or ""
                action = (payload.get("action") or "").strip().lower()
                if not isinstance(images, list) or not images:
                    self._send_json({"error": "Invalid images array"}, 400)
                    return
                bulk_update_tags(images, tag, action)
                self._send_json({"ok": True})
                return

            if path == "/api/tags/rename":
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                payload = load_json_body(self)
                old_tag = (payload.get("oldTag") or "").strip().lower()
                new_tag = (payload.get("newTag") or "").strip().lower()
                if not old_tag or not new_tag:
                    self._send_json({"error": "Both oldTag and newTag are required"}, 400)
                    return
                rename_tag_globally(old_tag, new_tag)
                self._send_json({"ok": True})
                return

            if path == "/api/tags/delete":
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                payload = load_json_body(self)
                tag = (payload.get("tag") or "").strip().lower()
                if not tag:
                    self._send_json({"error": "Tag is required"}, 400)
                    return
                delete_tag_globally(tag)
                self._send_json({"ok": True})
                return

            if path == "/api/share":
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                ensure_shares_dir()
                payload = load_json_body(self)
                images = payload.get("images") or []
                title = (payload.get("title") or "").strip()

                if not isinstance(images, list) or not images:
                    self._send_json({"error": "Invalid images array"}, 400)
                    return

                share_id = make_share_id()
                share_file = SHARES_DIR / f"{share_id}.json"
                while share_file.exists():
                    share_id = make_share_id()
                    share_file = SHARES_DIR / f"{share_id}.json"

                data = save_share_record(share_id, title, images, datetime.now(timezone.utc).isoformat())
                self._send_json({"ok": True, "id": share_id, "share": data})
                return

            match = re.fullmatch(r"/api/share/([^/]+)", path)
            if match:
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                share_id = unquote(match.group(1)).strip()
                share = load_share_record(share_id)
                if not share:
                    self._send_json({"error": "Shared page not found"}, 404)
                    return
                payload = load_json_body(self)
                title = payload.get("title", share.get("title") or "")
                images = payload.get("images", share.get("images") or [])
                if not isinstance(images, list):
                    self._send_json({"error": "Invalid images array"}, 400)
                    return
                updated = save_share_record(share_id, title, images, share.get("created_at"))
                self._send_json({"ok": True, "share": updated})
                return

            match = re.fullmatch(r"/api/share/([^/]+)/delete", path)
            if match:
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                share_id = unquote(match.group(1)).strip()
                share_file = SHARES_DIR / f"{share_id}.json"
                if not share_file.is_file():
                    self._send_json({"error": "Shared page not found"}, 404)
                    return
                share_file.unlink()
                self._send_json({"ok": True, "id": share_id})
                return

            if path == "/api/download":
                user = require_access(self)
                if REQUIRE_AUTH and not user:
                    return
                payload = load_json_body(self)
                files = payload.get("files") or []

                if not isinstance(files, list) or not files:
                    self._send_json({"error": "Invalid request"}, 400)
                    return

                tmp = io.BytesIO()
                with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                    for item in files:
                        original = item.get("original", "")
                        new_name = item.get("newName") or Path(original).name
                        if not original:
                            continue

                        try:
                            source = safe_path(original)
                        except ValueError:
                            continue

                        if not source.is_file():
                            continue

                        try:
                            data = process_image_bytes(source, payload)
                        except Exception:
                            data = source.read_bytes()

                        zf.writestr(new_name, data)
                        log_download(user, "zip", rel_url(source), new_name, self)

                body = tmp.getvalue()
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Content-Disposition", 'attachment; filename="selected-images.zip"')
                self.send_header("Cache-Control", "no-store")
                send_cors_headers(self)
                self.end_headers()
                self.wfile.write(body)
                return

            self._send_json({"error": "Not found"}, 404)

        except ValueError:
            self._send_json({"error": "Invalid path"}, 400)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)


if __name__ == "__main__":
    ensure_shares_dir()
    ensure_data_dir()
    ensure_thumb_cache_dir()
    init_db()
    bootstrap_admin_if_needed()
    print(f"Serving {ROOT} at http://localhost:{PORT}")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Perihelion image service stopped.")
    finally:
        server.server_close()
