"""
Directory scanner — walks a directory, classifies files as image or non-image,
and returns structured FileInfo records.
"""

import os
from collections import namedtuple

from utils import is_image

# ---------------------------------------------------------------------------
# Data structure returned for every file
# ---------------------------------------------------------------------------
FileInfo = namedtuple("FileInfo", [
    "path",            # absolute path to file
    "name",            # basename (e.g. "photo.jpg")
    "name_no_ext",     # basename without extension
    "extension",       # lowercase extension with dot (e.g. ".jpg")
    "size",            # file size in bytes
    "date_modified",   # os.path.getmtime timestamp
    "date_created",    # os.path.getctime timestamp
    "is_image",        # bool
])


def scan_directory(
    root: str,
    recursive: bool = True,
    max_depth: int | None = None,
) -> tuple[list[FileInfo], list[FileInfo]]:
    """
    Scan *root* and return (images, non_images) lists of FileInfo.

    Parameters
    ----------
    root : str
        Top-level directory to scan.
    recursive : bool
        If True, descend into sub-directories.
    max_depth : int | None
        Maximum depth to recurse.  None = unlimited.  0 = root only.
    """
    images: list[FileInfo] = []
    non_images: list[FileInfo] = []

    root = os.path.abspath(root)

    for dirpath, dirnames, filenames in os.walk(root):
        # --- depth check ---------------------------------------------------
        if not recursive:
            dirnames.clear()          # don't recurse at all
        elif max_depth is not None:
            depth = dirpath[len(root):].count(os.sep)
            if depth >= max_depth:
                dirnames.clear()

        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            try:
                stat = os.stat(fpath)
            except OSError:
                continue  # skip inaccessible files

            name_no_ext, ext = os.path.splitext(fname)
            info = FileInfo(
                path=fpath,
                name=fname,
                name_no_ext=name_no_ext,
                extension=ext.lower(),
                size=stat.st_size,
                date_modified=stat.st_mtime,
                date_created=stat.st_ctime,
                is_image=is_image(fname),
            )
            if info.is_image:
                images.append(info)
            else:
                non_images.append(info)

    return images, non_images
