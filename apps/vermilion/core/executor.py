"""
Executor — takes a Plan and carries it out on disk (move or copy).
Reports progress via a callback.  Records an undo log for reversal.
"""

import json
import os
import shutil
from datetime import datetime

from core.planner import Plan, PlannedFolder


# ---------------------------------------------------------------------------
# Conflict resolution strategies
# ---------------------------------------------------------------------------
CONFLICT_OVERWRITE = "overwrite"
CONFLICT_SKIP = "skip"
CONFLICT_AUTO_RENAME = "auto_rename"


def _resolve_conflict(dest_path: str, strategy: str) -> str | None:
    """
    Given a *dest_path* that already exists, return the actual path to write
    to, or None to skip.
    """
    if strategy == CONFLICT_OVERWRITE:
        return dest_path
    elif strategy == CONFLICT_SKIP:
        return None
    elif strategy == CONFLICT_AUTO_RENAME:
        base, ext = os.path.splitext(dest_path)
        counter = 1
        while True:
            candidate = f"{base}_{counter:02d}{ext}"
            if not os.path.exists(candidate):
                return candidate
            counter += 1
    return dest_path


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def execute_plan(
    plan: Plan,
    mode: str = "copy",            # "copy" or "move"
    conflict: str = CONFLICT_SKIP,
    progress_callback=None,         # callable(current, total, filename)
) -> dict:
    """
    Execute *plan* on disk.

    Returns a summary dict with keys:
        copied, moved, skipped, errors, total, undo_log_path
    """
    stats = {
        "copied": 0, "moved": 0, "skipped": 0,
        "errors": [], "total": 0, "undo_log_path": None,
    }

    # Undo log: records every successful operation for reversal
    undo_entries: list[dict] = []

    # Collect every PlannedFile in the plan
    all_files = _collect_all_files(plan)
    stats["total"] = len(all_files)

    for idx, pf in enumerate(all_files, 1):
        try:
            # Ensure target directory exists
            os.makedirs(pf.destination_dir, exist_ok=True)

            dest_path = os.path.join(pf.destination_dir, pf.new_name)

            # Conflict?
            if os.path.exists(dest_path) and \
               os.path.abspath(pf.source_path) != os.path.abspath(dest_path):
                dest_path = _resolve_conflict(dest_path, conflict)
                if dest_path is None:
                    stats["skipped"] += 1
                    if progress_callback:
                        progress_callback(idx, stats["total"], pf.original_name)
                    continue

            # Skip if source == dest (in-place with no rename)
            if os.path.abspath(pf.source_path) == os.path.abspath(dest_path):
                stats["skipped"] += 1
                if progress_callback:
                    progress_callback(idx, stats["total"], pf.original_name)
                continue

            if mode == "move":
                shutil.move(pf.source_path, dest_path)
                stats["moved"] += 1
            else:
                shutil.copy2(pf.source_path, dest_path)
                stats["copied"] += 1

            # Record for undo
            undo_entries.append({
                "action": mode,
                "source": pf.source_path,
                "destination": dest_path,
                "original_name": pf.original_name,
                "new_name": pf.new_name,
            })

        except Exception as e:
            stats["errors"].append((pf.source_path, str(e)))

        if progress_callback:
            progress_callback(idx, stats["total"], pf.original_name)

    # -- Write undo log -----------------------------------------------------
    if undo_entries:
        log_path = _write_undo_log(plan.root_path, undo_entries, mode)
        stats["undo_log_path"] = log_path

    return stats


def undo_last(log_path: str, progress_callback=None) -> dict:
    """
    Reverse the operations recorded in an undo log file.

    For 'move' operations: moves files back to their original location.
    For 'copy' operations: deletes the copied files.

    Returns a summary dict: {reversed, deleted, errors, total}.
    """
    stats = {"reversed": 0, "deleted": 0, "errors": [], "total": 0}

    with open(log_path, "r", encoding="utf-8") as f:
        log_data = json.load(f)

    entries = log_data.get("entries", [])
    stats["total"] = len(entries)

    # Process in reverse order
    for idx, entry in enumerate(reversed(entries), 1):
        try:
            dest = entry["destination"]
            source = entry["source"]
            action = entry["action"]

            if not os.path.exists(dest):
                stats["errors"].append((dest, "File no longer exists"))
                continue

            if action == "move":
                # Move it back
                os.makedirs(os.path.dirname(source), exist_ok=True)
                shutil.move(dest, source)
                stats["reversed"] += 1
            elif action == "copy":
                # Delete the copy
                os.remove(dest)
                stats["deleted"] += 1

        except Exception as e:
            stats["errors"].append((entry.get("destination", "?"), str(e)))

        if progress_callback:
            progress_callback(idx, stats["total"], entry.get("original_name", ""))

    return stats


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _collect_all_files(plan: Plan) -> list:
    """Flatten all PlannedFiles from the plan into a single list."""
    files = []

    def _walk_folders(folders):
        for folder in folders:
            files.extend(folder.files)
            if folder.children:
                _walk_folders(folder.children)

    _walk_folders(plan.folders)

    # Non-image folder
    if plan.non_image_folder:
        files.extend(plan.non_image_folder.files)

    # Filter folders (extension/size/date routed files)
    _walk_folders(plan.filter_folders)

    return files


def _write_undo_log(dest_dir: str, entries: list[dict], mode: str) -> str:
    """Write an undo log JSON file to the destination directory."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_filename = f"_undo_log_{timestamp}.json"
    log_path = os.path.join(dest_dir, log_filename)

    log_data = {
        "timestamp": datetime.now().isoformat(),
        "mode": mode,
        "file_count": len(entries),
        "entries": entries,
    }

    os.makedirs(dest_dir, exist_ok=True)
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)

    return log_path
