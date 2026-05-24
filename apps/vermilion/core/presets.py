"""
Presets — save and load named configurations as JSON files.
"""

import json
import os
from pathlib import Path


# Default presets directory next to the application
_PRESETS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "presets",
)


def get_presets_dir() -> str:
    """Return (and create if needed) the presets directory."""
    os.makedirs(_PRESETS_DIR, exist_ok=True)
    return _PRESETS_DIR


def list_presets() -> list[str]:
    """Return sorted list of preset names (without .json extension)."""
    d = get_presets_dir()
    names = []
    for f in os.listdir(d):
        if f.endswith(".json"):
            names.append(f[:-5])
    return sorted(names)


def save_preset(name: str, data: dict):
    """Save *data* as a named preset."""
    d = get_presets_dir()
    safe_name = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in name)
    path = os.path.join(d, f"{safe_name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_preset(name: str) -> dict:
    """Load a named preset. Returns empty dict if not found."""
    d = get_presets_dir()
    path = os.path.join(d, f"{name}.json")
    if not os.path.isfile(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def delete_preset(name: str):
    """Delete a named preset file."""
    d = get_presets_dir()
    path = os.path.join(d, f"{name}.json")
    if os.path.isfile(path):
        os.remove(path)
