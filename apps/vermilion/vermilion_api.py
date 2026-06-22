import base64
import json
import mimetypes
import os
import queue
import re
import shutil
import sqlite3
import string
import threading
import time
import uuid
from datetime import datetime, date, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from core.scanner import scan_directory
from core.planner import PlanConfig, generate_plan
from core.executor import execute_plan, undo_last
from core.renamer import RenameComponent, build_rename_func
from core.presets import list_presets, save_preset, load_preset, delete_preset

# ─── Config ──────────────────────────────────────────────────────────────────────────────

PORT = int(os.environ.get('VERMILION_PORT', '8100'))
HOST = '0.0.0.0'

CENTRAL_AUTH_DB_PATH = Path(
    os.environ.get('VERMILION_CENTRAL_AUTH_DB_PATH', 
                   os.environ.get('MILLIONFOLD_CENTRAL_AUTH_DB_PATH', 
                                  r'E:\\auth-jeffersonwm\\backend\\data\\auth-jeffersonwm.sqlite3'))
).resolve()
CENTRAL_SESSION_COOKIE_NAME = os.environ.get('VERMILION_CENTRAL_SESSION_COOKIE_NAME', 
                                             os.environ.get('MILLIONFOLD_CENTRAL_SESSION_COOKIE_NAME', 
                                                            'auth_jeffersonwm_session'))
REQUIRED_APP_MEMBERSHIP = os.environ.get('VERMILION_REQUIRED_APP_MEMBERSHIP', 'vermilion').strip()
REQUIRE_AUTH = os.environ.get('VERMILION_REQUIRE_AUTH', 'true').lower() in {'1', 'true', 'yes', 'on'}

DEFAULT_ORIGIN = 'https://jeffersonwm.com'
ALLOWED_ORIGINS = {
    'https://jeffersonwm.com',
    'https://www.jeffersonwm.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
}

_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime | None = None) -> str:
    return (value or utc_now()).isoformat()


def parse_iso(value: str) -> datetime:
    normalized = value.strip()
    if normalized.endswith('Z'):
        normalized = f'{normalized[:-1]}+00:00'
    return datetime.fromisoformat(normalized)


def resolve_origin(handler: BaseHTTPRequestHandler) -> str:
    origin = handler.headers.get('Origin', '')
    if origin in ALLOWED_ORIGINS:
        return origin
    return DEFAULT_ORIGIN


def send_cors_headers(handler: BaseHTTPRequestHandler) -> None:
    handler.send_header('Access-Control-Allow-Origin', resolve_origin(handler))
    handler.send_header('Access-Control-Allow-Credentials', 'true')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Vary', 'Origin')


def cookie_map(handler: BaseHTTPRequestHandler) -> dict[str, str]:
    header = handler.headers.get('Cookie', '')
    cookies: dict[str, str] = {}
    for part in header.split(';'):
        if '=' not in part:
            continue
        key, value = part.split('=', 1)
        cookies[key.strip()] = value.strip()
    return cookies


def load_json_body(handler: BaseHTTPRequestHandler):
    length = int(handler.headers.get('Content-Length', '0'))
    raw = handler.rfile.read(length) if length > 0 else b'{}'
    if not raw:
        return {}
    return json.loads(raw.decode('utf-8'))


def central_auth_db_connect() -> sqlite3.Connection | None:
    if not CENTRAL_AUTH_DB_PATH.is_file():
        return None
    conn = sqlite3.connect(str(CENTRAL_AUTH_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def central_membership_granted(conn: sqlite3.Connection, user_id: int | str, app_key: str) -> bool:
    if not app_key:
        return True
    row = conn.execute(
        'SELECT 1 FROM user_app_memberships WHERE user_id = ? AND app_key = ?',
        (str(user_id), app_key),
    ).fetchone()
    return bool(row)


def serialize_user(row: sqlite3.Row | None) -> dict | None:
    if not row:
        return None
    return {
        'id': row['id'],
        'username': row['username'],
        'isAdmin': bool(row['is_admin']),
        'isApproved': bool(row['is_approved']),
        'isBlocked': bool(row['is_blocked']),
    }


def current_user_from_handler(handler: BaseHTTPRequestHandler) -> dict | None:
    token = cookie_map(handler).get(CENTRAL_SESSION_COOKIE_NAME)
    if not token:
        return None
    conn = central_auth_db_connect()
    if not conn:
        return None
    with conn:
        row = conn.execute(
            '''
            SELECT users.id, users.username, users.is_admin, users.is_approved, users.is_blocked,
                   sessions.expires_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            ''',
            (token,),
        ).fetchone()
        if not row:
            return None
        try:
            expires_at = parse_iso(row['expires_at'])
        except Exception:
            return None
        if expires_at <= utc_now():
            return None
        if row['is_blocked'] or not row['is_approved']:
            return None
        if not central_membership_granted(conn, row['id'], REQUIRED_APP_MEMBERSHIP):
            return None
        return serialize_user(row)


def require_access(handler: BaseHTTPRequestHandler) -> dict | None:
    if not REQUIRE_AUTH:
        return {'id': 0, 'username': 'anonymous', 'isAdmin': False, 'isApproved': True, 'isBlocked': False}
    user = current_user_from_handler(handler)
    if user:
        return user
    handler._send_json({'error': 'Authentication required'}, 401)
    return None


class FilterConfig:
    def __init__(self, **kwargs):
        self.kind = kwargs.get("kind", "")
        self.action = kwargs.get("action", "ignore")
        self.folder_name = kwargs.get("folder_name", "")
        self.extensions = set(kwargs.get("extensions", []))
        self.size_mode = kwargs.get("size_mode", "above")
        self.size_min = int(kwargs.get("size_min", 0) or 0)
        self.size_max = int(kwargs.get("size_max", 0) or 0)
        self.date_field = kwargs.get("date_field", "modified")
        self.date_mode = kwargs.get("date_mode", "before")
        self.date_from = kwargs.get("date_from", "")
        self.date_to = kwargs.get("date_to", "")


def serialize_planned_file(pf):
    return {
        "source_path": pf.source_path,
        "original_name": pf.original_name,
        "new_name": pf.new_name,
        "destination_dir": pf.destination_dir
    }


def serialize_planned_folder(pf):
    return {
        "display_name": pf.display_name,
        "path": pf.path,
        "files": [serialize_planned_file(f) for f in pf.files],
        "children": [serialize_planned_folder(c) for c in pf.children]
    }


def serialize_plan(plan):
    return {
        "root_path": plan.root_path,
        "folders": [serialize_planned_folder(f) for f in plan.folders],
        "non_image_folder": serialize_planned_folder(plan.non_image_folder) if plan.non_image_folder else None,
        "filter_folders": [serialize_planned_folder(f) for f in plan.filter_folders],
        "total_images": plan.total_images,
        "total_non_images": plan.total_non_images,
        "total_filtered": plan.total_filtered,
        "total_folders": plan.total_folders
    }


def build_plan_config(config):
    source_dir = config.get("source_dir", "").strip()
    dest_dir = config.get("dest_dir", "").strip()
    recursive = config.get("recursive", True)

    components = []
    for r in config.get("rename_rules", []):
        kind = r.get("type", "")
        if not kind:
            continue
        comp = RenameComponent(
            kind=kind,
            enabled=r.get("enabled", True),
            text=r.get("value", "") if kind == "text" else "",
            seq_start=int(r.get("value", 1) or 1) if kind == "sequence" else 1,
            seq_digits=int(r.get("padding", 3) or 3) if kind == "sequence" else 3,
            date_format=r.get("value", "%Y%m%d") if kind == "date" else "%Y%m%d",
        )
        if kind == "date":
            fmt = r.get("value", "YYYYMMDD")
            fmt = fmt.replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
            comp.date_format = fmt
        components.append(comp)

    separator = config.get("separator", "_")
    rename_func = build_rename_func(components, separator) if components else None

    filters = []
    for f in config.get("filters", []):
        filters.append(FilterConfig(**f))

    return PlanConfig(
        source_dir=source_dir,
        dest_dir=dest_dir,
        sort_by=config.get("sort_by", "char"),
        char_count=int(config.get("char_count", 1) or 1),
        distribution_mode=config.get("distribution_mode", "max_per_folder"),
        distribution_count=int(config.get("distribution_count", 50) or 50),
        structure=config.get("structure", "flat"),
        append_range=bool(config.get("append_range", True)),
        recursive=recursive,
        rename_func=rename_func,
        filters=filters
    )


def run_execution_job(job_id, config, mode, conflict):
    q = _jobs[job_id]['queue']
    emit = q.put
    try:
        source_dir = config.get("source_dir", "").strip()
        recursive = config.get("recursive", True)
        images, non_images = scan_directory(source_dir, recursive=recursive)

        plan_config = build_plan_config(config)
        plan = generate_plan(images, non_images, plan_config)

        def cb(current, total, filename):
            emit({
                "type": "progress",
                "current": current,
                "total": total,
                "filename": filename
            })

        stats = execute_plan(plan, mode=mode, conflict=conflict, progress_callback=cb)

        emit({
            "type": "done",
            "copied": stats["copied"],
            "moved": stats["moved"],
            "skipped": stats["skipped"],
            "errors": stats["errors"],
            "undo_log_path": stats["undo_log_path"]
        })
    except Exception as e:
        emit({"type": "error", "error": str(e)})
    finally:
        with _jobs_lock:
            _jobs[job_id]['done'] = True


def run_undo_job(job_id, undo_log_path):
    q = _jobs[job_id]['queue']
    emit = q.put
    try:
        def cb(current, total, filename):
            emit({
                "type": "progress",
                "current": current,
                "total": total,
                "filename": filename
            })

        stats = undo_last(undo_log_path, progress_callback=cb)

        emit({
            "type": "done",
            "reversed": stats["reversed"],
            "deleted": stats["deleted"],
            "errors": stats["errors"],
            "total": stats["total"]
        })
    except Exception as e:
        emit({"type": "error", "error": str(e)})
    finally:
        with _jobs_lock:
            _jobs[job_id]['done'] = True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        send_cors_headers(self)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        send_cors_headers(self)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/auth':
            user = current_user_from_handler(self)
            if not REQUIRE_AUTH:
                self._send_json({'ok': True, 'user': None, 'requireAuth': False})
                return
            self._send_json({'ok': bool(user), 'user': user, 'requireAuth': True})
            return

        if path == '/api/health':
            self._send_json({'ok': True, 'pillow': PIL_AVAILABLE})
            return

        if path == '/api/browse':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return

            params = parse_qs(parsed.query)
            folder_path = unquote(params.get('path', [''])[0]).strip()

            if not folder_path:
                # List logical drives on Windows
                drives = []
                for letter in string.ascii_uppercase:
                    drv = f"{letter}:\\"
                    if os.path.exists(drv):
                        drives.append(drv)
                
                cwd = os.getcwd()
                if cwd.startswith("\\\\"):
                    parts = cwd.split(os.sep)
                    if len(parts) >= 4:
                        unc_root = os.sep.join(parts[:4]) + os.sep
                        if unc_root not in drives:
                            drives.append(unc_root)

                self._send_json({
                    "drives": drives,
                    "directories": [],
                    "files": [],
                    "current_path": ""
                })
                return

            if not os.path.isdir(folder_path):
                self._send_json({'error': 'Not a directory or directory does not exist'}, 400)
                return

            try:
                folder_path = os.path.abspath(folder_path)
                dirs = []
                files = []
                for entry in os.scandir(folder_path):
                    if entry.is_dir():
                        dirs.append({
                            "name": entry.name,
                            "path": entry.path
                        })
                    elif entry.is_file():
                        files.append({
                            "name": entry.name,
                            "path": entry.path
                        })
                
                self._send_json({
                    "current_path": folder_path,
                    "parent_path": os.path.dirname(folder_path) if os.path.dirname(folder_path) != folder_path else None,
                    "directories": sorted(dirs, key=lambda d: d["name"].lower()),
                    "files": sorted(files, key=lambda f: f["name"].lower())
                })
            except Exception as e:
                self._send_json({'error': str(e)}, 500)
            return

        if path == '/api/scan':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return

            params = parse_qs(parsed.query)
            folder = unquote(params.get('folder', [''])[0]).strip()
            recursive = params.get('recursive', ['false'])[0].lower() in {'1', 'true'}

            if not folder or not os.path.isdir(folder):
                self._send_json({'error': 'Folder not found'}, 400)
                return

            try:
                images, non_images = scan_directory(folder, recursive=recursive)
                self._send_json({
                    'images_count': len(images),
                    'non_images_count': len(non_images),
                    'total_count': len(images) + len(non_images),
                    'folder': folder
                })
            except Exception as e:
                self._send_json({'error': str(e)}, 500)
            return

        if path == '/api/file':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return

            params = parse_qs(parsed.query)
            file_path = unquote(params.get('path', [''])[0]).strip()
            if not file_path or not os.path.isfile(file_path):
                self._send_json({'error': 'File not found'}, 404)
                return

            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = 'application/octet-stream'

            try:
                stat = os.stat(file_path)
                self.send_response(200)
                self.send_header('Content-Type', mime_type)
                self.send_header('Content-Length', str(stat.st_size))
                self.send_header('Cache-Control', 'public, max-age=86400')
                send_cors_headers(self)
                self.end_headers()

                with open(file_path, 'rb') as f:
                    shutil.copyfileobj(f, self.wfile)
            except Exception:
                pass
            return

        if path.startswith('/api/progress/'):
            user = require_access(self)
            if REQUIRE_AUTH and not user: return
            job_id = path.split('/')[-1]

            with _jobs_lock:
                job = _jobs.get(job_id)
            if not job:
                self._send_json({'error': 'Job not found'}, 404)
                return

            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            send_cors_headers(self)
            self.end_headers()

            q = job['queue']
            while True:
                try:
                    event = q.get(timeout=0.5)
                    data = json.dumps(event, ensure_ascii=False)
                    self.wfile.write(f'data: {data}\n\n'.encode('utf-8'))
                    self.wfile.flush()
                    if event.get('type') in {'done', 'error'}:
                        break
                except Exception as e:
                    if 'Empty' in type(e).__name__:
                        with _jobs_lock:
                            if _jobs[job_id].get('done'):
                                break
                        try:
                            self.wfile.write(b': keepalive\n\n')
                            self.wfile.flush()
                        except Exception:
                            break
                    else:
                        break
            return

        if path == '/api/presets':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return

            params = parse_qs(parsed.query)
            preset_name = unquote(params.get('name', [''])[0]).strip()

            if preset_name:
                preset_data = load_preset(preset_name)
                self._send_json(preset_data)
            else:
                names = list_presets()
                presets_data = {}
                for name in names:
                    presets_data[name] = load_preset(name)
                self._send_json({"presets": presets_data})
            return

        self._send_json({'error': 'Not found'}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/browse/create':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return
            try:
                body = load_json_body(self)
            except Exception:
                self._send_json({'error': 'Invalid JSON'}, 400)
                return

            folder_path = body.get("path", "").strip()
            if not folder_path:
                self._send_json({'error': 'Path is required'}, 400)
                return
            try:
                os.makedirs(folder_path, exist_ok=True)
                self._send_json({'ok': True, 'path': folder_path})
            except Exception as e:
                self._send_json({'error': str(e)}, 500)
            return

        if path == '/api/plan':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return
            try:
                body = load_json_body(self)
            except Exception:
                self._send_json({'error': 'Invalid JSON'}, 400)
                return

            source_dir = body.get("source_dir", "").strip()
            if not source_dir or not os.path.isdir(source_dir):
                self._send_json({'error': 'Source directory does not exist'}, 400)
                return

            try:
                images, non_images = scan_directory(source_dir, recursive=body.get("recursive", True))
                plan_config = build_plan_config(body)
                plan = generate_plan(images, non_images, plan_config)
                self._send_json(serialize_plan(plan))
            except Exception as e:
                self._send_json({'error': str(e)}, 500)
            return

        if path == '/api/execute':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return
            try:
                body = load_json_body(self)
            except Exception:
                self._send_json({'error': 'Invalid JSON'}, 400)
                return

            config = body.get("config", {})
            mode = body.get("mode", "copy")
            conflict = body.get("conflict", "skip")

            source_dir = config.get("source_dir", "").strip()
            if not source_dir or not os.path.isdir(source_dir):
                self._send_json({'error': 'Source directory does not exist'}, 400)
                return

            job_id = str(uuid.uuid4())
            job_queue = queue.Queue()
            job_entry = {'queue': job_queue, 'done': False}
            with _jobs_lock:
                _jobs[job_id] = job_entry

            thread = threading.Thread(
                target=run_execution_job,
                args=(job_id, config, mode, conflict),
                daemon=True
            )
            job_entry['thread'] = thread
            thread.start()

            self._send_json({'job_id': job_id})
            return

        if path == '/api/undo':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return
            try:
                body = load_json_body(self)
            except Exception:
                self._send_json({'error': 'Invalid JSON'}, 400)
                return

            undo_log_path = body.get("undo_log_path", "").strip()
            if not undo_log_path or not os.path.isfile(undo_log_path):
                self._send_json({'error': f'Undo log file not found: {undo_log_path!r}'}, 400)
                return

            job_id = str(uuid.uuid4())
            job_queue = queue.Queue()
            job_entry = {'queue': job_queue, 'done': False}
            with _jobs_lock:
                _jobs[job_id] = job_entry

            thread = threading.Thread(
                target=run_undo_job,
                args=(job_id, undo_log_path),
                daemon=True
            )
            job_entry['thread'] = thread
            thread.start()

            self._send_json({'job_id': job_id})
            return

        if path == '/api/presets':
            user = require_access(self)
            if REQUIRE_AUTH and not user: return
            try:
                body = load_json_body(self)
            except Exception:
                self._send_json({'error': 'Invalid JSON'}, 400)
                return

            action = body.get("action", "save")
            name = body.get("name", "").strip()

            if not name:
                self._send_json({'error': 'Preset name is required'}, 400)
                return

            try:
                if action == "save":
                    config = body.get("config", {})
                    save_preset(name, config)
                    self._send_json({'ok': True})
                elif action == "delete":
                    delete_preset(name)
                    self._send_json({'ok': True})
                else:
                    self._send_json({'error': f'Unknown action: {action!r}'}, 400)
            except Exception as e:
                self._send_json({'error': str(e)}, 500)
            return

        self._send_json({'error': 'Not found'}, 404)


if __name__ == '__main__':
    print(f'Vermilion API running at http://localhost:{PORT}')
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.serve_forever()
