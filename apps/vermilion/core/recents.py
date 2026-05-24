"""
Recents — persist recently-used source and destination directories.
"""

import json
import os

_RECENTS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "_recents.json",
)

MAX_RECENTS = 8


def _load() -> dict:
    if os.path.isfile(_RECENTS_FILE):
        try:
            with open(_RECENTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"source": [], "dest": []}


def _save(data: dict):
    with open(_RECENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_recent_sources() -> list[str]:
    return _load().get("source", [])


def get_recent_dests() -> list[str]:
    return _load().get("dest", [])


def add_recent_source(path: str):
    data = _load()
    lst = data.setdefault("source", [])
    path = os.path.normpath(path)
    if path in lst:
        lst.remove(path)
    lst.insert(0, path)
    data["source"] = lst[:MAX_RECENTS]
    _save(data)


def add_recent_dest(path: str):
    data = _load()
    lst = data.setdefault("dest", [])
    path = os.path.normpath(path)
    if path in lst:
        lst.remove(path)
    lst.insert(0, path)
    data["dest"] = lst[:MAX_RECENTS]
    _save(data)
