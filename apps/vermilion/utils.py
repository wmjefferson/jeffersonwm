"""
Shared constants and utility functions for Vermilion.
"""

import os
import re

# ---------------------------------------------------------------------------
# Image extension whitelist (lowercase, with leading dot)
# ---------------------------------------------------------------------------
IMAGE_EXTENSIONS: set[str] = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp",
    ".tiff", ".tif", ".webp", ".svg", ".ico",
    ".raw", ".cr2", ".nef", ".arw", ".dng",
    ".heic", ".heif", ".avif", ".psd", ".exr",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_image(filename: str) -> bool:
    """Return True if *filename* has an image extension."""
    _, ext = os.path.splitext(filename)
    return ext.lower() in IMAGE_EXTENSIONS


def natural_sort_key(s: str):
    """
    Sort key that orders digits numerically and letters alphabetically,
    with digits (0-9) coming before letters (A-Z).
    '2' < '10' < 'A' < 'Z' < 'a' (case-insensitive treated as upper)
    """
    parts = re.split(r'(\d+)', s)
    result = []
    for part in parts:
        if part.isdigit():
            # (0, number) — digits sort before letters
            result.append((0, int(part), part))
        else:
            # (1, uppercased) — letters sort after digits
            result.append((1, 0, part.upper()))
    return result


def safe_folder_name(name: str) -> str:
    """Sanitise *name* so it is a valid Windows directory name."""
    # Replace characters illegal in Windows paths
    cleaned = re.sub(r'[<>:"/\\|?*]', '_', name)
    # Strip trailing dots and spaces (Windows quirk)
    cleaned = cleaned.rstrip('. ')
    return cleaned or '_'


def sort_key_for_file(file_info, sort_by: str, char_count: int = 1):
    """
    Return a sort key for a FileInfo namedtuple based on the chosen sort mode.

    Parameters
    ----------
    file_info : FileInfo
        As returned by scanner.scan_directory.
    sort_by : str
        One of 'char', 'full', 'date_modified', 'date_created'.
    char_count : int
        Number of leading characters when sort_by == 'char'.
    """
    if sort_by == "char":
        return file_info.name[:char_count].upper()
    elif sort_by == "full":
        return file_info.name.upper()
    elif sort_by == "date_modified":
        return file_info.date_modified
    elif sort_by == "date_created":
        return file_info.date_created
    else:
        return file_info.name.upper()


def group_key_for_file(file_info, sort_by: str, char_count: int = 1) -> str:
    """
    Return the *grouping* key (the folder label) for a file.
    For character modes this is the uppercase N-char prefix.
    For date modes this is the date string (YYYY-MM-DD).
    For full-name mode there is no natural grouping — returns the full name
    (caller should switch to even-distribution instead).
    """
    import datetime

    if sort_by == "char":
        prefix = file_info.name[:char_count].upper()
        # Pad if filename is shorter than char_count
        return prefix.ljust(char_count, '_')
    elif sort_by == "date_modified":
        dt = datetime.datetime.fromtimestamp(file_info.date_modified)
        return dt.strftime("%Y-%m-%d")
    elif sort_by == "date_created":
        dt = datetime.datetime.fromtimestamp(file_info.date_created)
        return dt.strftime("%Y-%m-%d")
    else:
        # full filename — no grouping
        return file_info.name.upper()
