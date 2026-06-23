"""
Planner — takes scan results + user options and produces a Plan describing
the target folder structure and file assignments *without* touching disk.
"""

import datetime
import math
import os
from collections import OrderedDict
from dataclasses import dataclass, field

from utils import (
    group_key_for_file,
    natural_sort_key,
    safe_folder_name,
    sort_key_for_file,
)


# ---------------------------------------------------------------------------
# Data classes that describe the plan
# ---------------------------------------------------------------------------

@dataclass
class PlannedFile:
    """One file's journey from source to destination."""
    source_path: str
    original_name: str
    new_name: str        # after rename (same as original_name if rename disabled)
    destination_dir: str  # full path to target folder


@dataclass
class PlannedFolder:
    """One output folder."""
    display_name: str    # human-readable label for the preview tree
    path: str            # full output path
    files: list[PlannedFile] = field(default_factory=list)
    children: list['PlannedFolder'] = field(default_factory=list)


@dataclass
class Plan:
    """Complete reorganisation plan."""
    root_path: str
    folders: list[PlannedFolder] = field(default_factory=list)
    non_image_folder: PlannedFolder | None = None
    filter_folders: list[PlannedFolder] = field(default_factory=list)
    total_images: int = 0
    total_non_images: int = 0
    total_filtered: int = 0
    total_folders: int = 0


# ---------------------------------------------------------------------------
# Configuration container
# ---------------------------------------------------------------------------

@dataclass
class PlanConfig:
    source_dir: str
    dest_dir: str
    sort_by: str              # 'char', 'full', 'date_modified', 'date_created'
    char_count: int           # 1, 2, or 3 (only used when sort_by == 'char')
    distribution_mode: str    # 'max_per_folder' or 'num_folders'
    distribution_count: int   # the number for the chosen mode
    structure: str            # 'flat' or 'nested'
    append_range: bool        # append " - Aa - Az" to folder names
    recursive: bool           # scan subfolders in source
    rename_func: object       # callable(file_info, seq_num) -> new_name, or None
    filters: list = field(default_factory=list)  # list of FilterConfig objects


# ---------------------------------------------------------------------------
# Filter application
# ---------------------------------------------------------------------------

def _apply_filters(images: list, filters: list, dest_dir: str):
    """
    Apply filter rules to images.

    Returns (remaining_images, filter_folders) where filter_folders is a list
    of PlannedFolder for files that matched a "move" filter, and
    remaining_images excludes both ignored and moved files.
    """
    if not filters:
        return images, []

    remaining = list(images)
    move_buckets: dict[str, list] = {}   # folder_name -> list of file_info

    for filt in filters:
        still_remaining = []
        for fi in remaining:
            if _file_matches_filter(fi, filt):
                if filt.action == "ignore":
                    pass  # drop it
                elif filt.action == "move":
                    fname = filt.folder_name or "FILTERED"
                    move_buckets.setdefault(fname, []).append(fi)
            else:
                still_remaining.append(fi)
        remaining = still_remaining

    # Build PlannedFolders for move buckets
    filter_folders = []
    for fname, files in move_buckets.items():
        fpath = os.path.join(dest_dir, safe_folder_name(fname))
        pf = PlannedFolder(
            display_name=f"{fname} ({len(files)})",
            path=fpath,
            files=[
                PlannedFile(
                    source_path=f.path,
                    original_name=f.name,
                    new_name=f.name,
                    destination_dir=fpath,
                )
                for f in files
            ],
        )
        filter_folders.append(pf)

    return remaining, filter_folders


def _file_matches_filter(fi, filt) -> bool:
    """Check if a FileInfo matches a FilterConfig."""
    if filt.kind == "extension":
        return fi.extension in filt.extensions

    elif filt.kind == "size":
        size = fi.size
        if filt.size_mode == "above":
            return size > filt.size_min
        elif filt.size_mode == "below":
            return size < filt.size_max
        elif filt.size_mode == "between":
            return filt.size_min <= size <= filt.size_max

    elif filt.kind == "date":
        ts = fi.date_modified if filt.date_field == "modified" else fi.date_created
        try:
            file_date = datetime.datetime.fromtimestamp(ts).date()
        except (OSError, ValueError):
            return False

        if filt.date_mode == "before":
            try:
                target = datetime.date.fromisoformat(filt.date_from)
            except ValueError:
                return False
            return file_date < target
        elif filt.date_mode == "after":
            try:
                target = datetime.date.fromisoformat(filt.date_from)
            except ValueError:
                return False
            return file_date > target
        elif filt.date_mode == "between":
            try:
                d_from = datetime.date.fromisoformat(filt.date_from)
                d_to = datetime.date.fromisoformat(filt.date_to)
            except ValueError:
                return False
            return d_from <= file_date <= d_to

    return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_plan(images: list, non_images: list, config: PlanConfig) -> Plan:
    """
    Build a Plan from scanned file lists and user configuration.
    """
    # -- Apply filters to images before distribution ------------------------
    filtered_images, filter_folders = _apply_filters(
        images, config.filters, config.dest_dir,
    )

    plan = Plan(
        root_path=config.dest_dir,
        total_images=len(filtered_images),
        total_non_images=len(non_images),
        total_filtered=len(images) - len(filtered_images),
        filter_folders=filter_folders,
    )

    # -- Non-image folder ---------------------------------------------------
    if non_images:
        ni_path = os.path.join(config.dest_dir, "_NON_IMAGE")
        ni_folder = PlannedFolder(
            display_name=f"_NON_IMAGE ({len(non_images)})",
            path=ni_path,
            files=[
                PlannedFile(
                    source_path=f.path,
                    original_name=f.name,
                    new_name=f.name,
                    destination_dir=ni_path,
                )
                for f in non_images
            ],
        )
        plan.non_image_folder = ni_folder

    if not filtered_images:
        return plan

    # -- Sort images --------------------------------------------------------
    images_sorted = sorted(
        filtered_images,
        key=lambda f: (natural_sort_key(
            str(sort_key_for_file(f, config.sort_by, config.char_count))
        )),
    )

    # -- Apply rename if enabled --------------------------------------------
    def _make_name(fi, seq):
        if config.rename_func:
            return config.rename_func(fi, seq)
        return fi.name

    # -- Choose strategy ----------------------------------------------------
    # "exact_per_folder" always uses sequential chunking regardless of sort.
    # Character grouping is only used when the sort mode is char/date AND
    # the distribution mode is not "exact_per_folder".
    if config.distribution_mode in ("group_by_date", "group_by_name"):
        plan.folders = _plan_pure_grouping(images_sorted, config, _make_name)
    elif config.distribution_mode == "exact_per_folder":
        plan.folders = _plan_even_distribution(images_sorted, config, _make_name)
    elif config.sort_by == "char" or config.sort_by.startswith("date_modified") or config.sort_by.startswith("date_created"):
        plan.folders = _plan_character_grouping(images_sorted, config, _make_name)
    else:
        # full filename — even distribution
        plan.folders = _plan_even_distribution(images_sorted, config, _make_name)

    # Count total folders (recursive)
    plan.total_folders = _count_folders(plan.folders)

    return plan


# ---------------------------------------------------------------------------
# Strategy: pure grouping (no count-based splits)
# ---------------------------------------------------------------------------

def _plan_pure_grouping(images, config, make_name):
    """Group files by their sort key prefix, without any splits."""
    # 1. Group
    groups: OrderedDict[str, list] = OrderedDict()
    for fi in images:
        key = group_key_for_file(fi, config.sort_by, config.char_count)
        groups.setdefault(key, []).append(fi)

    # 2. Sort group keys naturally (0-9 before A-Z)
    sorted_keys = sorted(groups.keys(), key=natural_sort_key)

    folders: list[PlannedFolder] = []
    global_seq = 1

    for gkey in sorted_keys:
        group_files = groups[gkey]
        safe_gkey = safe_folder_name(gkey)

        folder_label = safe_gkey
        if config.append_range and len(group_files) > 0:
            first = _sort_prefix(group_files[0], config)
            last = _sort_prefix(group_files[-1], config)
            if first != last:
                folder_label += f" - {first} - {last}"

        folder_path = os.path.join(config.dest_dir, safe_gkey)
        pf = PlannedFolder(
            display_name=f"{folder_label} ({len(group_files)})",
            path=folder_path,
        )
        for fi in group_files:
            pf.files.append(PlannedFile(
                source_path=fi.path,
                original_name=fi.name,
                new_name=make_name(fi, global_seq),
                destination_dir=folder_path,
            ))
            global_seq += 1
        folders.append(pf)

    return folders


# ---------------------------------------------------------------------------
# Strategy: character / date grouping
# ---------------------------------------------------------------------------

def _plan_character_grouping(images, config, make_name):
    """Group files by their sort key prefix, then split overflows."""
    # 1. Group
    groups: OrderedDict[str, list] = OrderedDict()
    for fi in images:
        key = group_key_for_file(fi, config.sort_by, config.char_count)
        groups.setdefault(key, []).append(fi)

    # 2. Sort group keys naturally (0-9 before A-Z)
    sorted_keys = sorted(groups.keys(), key=natural_sort_key)

    # 3. Determine max per folder
    if config.distribution_mode == "max_per_folder":
        max_per = config.distribution_count
    else:
        # num_folders: distribute evenly across the requested count
        # but respect grouping — we split each group proportionally
        max_per = max(1, math.ceil(len(images) / config.distribution_count))

    folders: list[PlannedFolder] = []
    global_seq = 1

    for gkey in sorted_keys:
        group_files = groups[gkey]
        safe_gkey = safe_folder_name(gkey)

        if len(group_files) <= max_per:
            # Fits in one folder — no subfolders needed
            folder_label = safe_gkey
            if config.append_range and len(group_files) > 0:
                first = _sort_prefix(group_files[0], config)
                last = _sort_prefix(group_files[-1], config)
                if first != last:
                    folder_label += f" - {first} - {last}"

            folder_path = os.path.join(config.dest_dir, safe_gkey)
            pf = PlannedFolder(
                display_name=f"{folder_label} ({len(group_files)})",
                path=folder_path,
            )
            for fi in group_files:
                pf.files.append(PlannedFile(
                    source_path=fi.path,
                    original_name=fi.name,
                    new_name=make_name(fi, global_seq),
                    destination_dir=folder_path,
                ))
                global_seq += 1
            folders.append(pf)
        else:
            # Split into sub-chunks
            chunks = _chunk_list(group_files, max_per)
            num_digits = len(str(len(chunks)))

            if config.structure == "nested":
                # Parent folder for the group
                parent_path = os.path.join(config.dest_dir, safe_gkey)
                parent_folder = PlannedFolder(
                    display_name=f"{safe_gkey} ({len(group_files)})",
                    path=parent_path,
                )
                for idx, chunk in enumerate(chunks, 1):
                    seq_str = str(idx).zfill(num_digits)
                    sub_label = seq_str
                    if config.append_range:
                        first = _sort_prefix(chunk[0], config)
                        last = _sort_prefix(chunk[-1], config)
                        if first != last:
                            sub_label += f" - {first} - {last}"

                    sub_path = os.path.join(parent_path, safe_folder_name(sub_label))
                    sf = PlannedFolder(
                        display_name=f"{sub_label} ({len(chunk)})",
                        path=sub_path,
                    )
                    for fi in chunk:
                        sf.files.append(PlannedFile(
                            source_path=fi.path,
                            original_name=fi.name,
                            new_name=make_name(fi, global_seq),
                            destination_dir=sub_path,
                        ))
                        global_seq += 1
                    parent_folder.children.append(sf)

                folders.append(parent_folder)
            else:
                # Flat: SD-01, SD-02
                for idx, chunk in enumerate(chunks, 1):
                    seq_str = str(idx).zfill(num_digits)
                    flat_name = f"{safe_gkey}-{seq_str}"
                    if config.append_range:
                        first = _sort_prefix(chunk[0], config)
                        last = _sort_prefix(chunk[-1], config)
                        if first != last:
                            flat_name += f" - {first} - {last}"

                    folder_path = os.path.join(config.dest_dir, safe_folder_name(flat_name))
                    pf = PlannedFolder(
                        display_name=f"{flat_name} ({len(chunk)})",
                        path=folder_path,
                    )
                    for fi in chunk:
                        pf.files.append(PlannedFile(
                            source_path=fi.path,
                            original_name=fi.name,
                            new_name=make_name(fi, global_seq),
                            destination_dir=folder_path,
                        ))
                        global_seq += 1
                    folders.append(pf)

    return folders


# ---------------------------------------------------------------------------
# Strategy: even distribution (for 'full' filename sort)
# ---------------------------------------------------------------------------

def _plan_even_distribution(images, config, make_name):
    """Distribute files evenly without character grouping."""
    total = len(images)

    if config.distribution_mode in ("max_per_folder", "exact_per_folder"):
        max_per = config.distribution_count
        num_folders = math.ceil(total / max_per)
    else:
        num_folders = config.distribution_count
        max_per = math.ceil(total / num_folders) if num_folders > 0 else total

    chunks = _chunk_list(images, max_per)
    num_digits = max(2, len(str(len(chunks))))

    folders: list[PlannedFolder] = []
    global_seq = 1

    for idx, chunk in enumerate(chunks, 1):
        seq_str = str(idx).zfill(num_digits)
        folder_name = seq_str
        if config.append_range and len(chunk) > 0:
            first = _sort_prefix(chunk[0], config)
            last = _sort_prefix(chunk[-1], config)
            if first != last:
                folder_name += f" - {first} - {last}"

        folder_path = os.path.join(config.dest_dir, safe_folder_name(folder_name))
        pf = PlannedFolder(
            display_name=f"{folder_name} ({len(chunk)})",
            path=folder_path,
        )
        for fi in chunk:
            pf.files.append(PlannedFile(
                source_path=fi.path,
                original_name=fi.name,
                new_name=make_name(fi, global_seq),
                destination_dir=folder_path,
            ))
            global_seq += 1
        folders.append(pf)

    return folders


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chunk_list(lst: list, chunk_size: int) -> list[list]:
    """Split *lst* into sub-lists of at most *chunk_size*."""
    if chunk_size <= 0:
        return [lst]
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


def _sort_prefix(file_info, config: PlanConfig) -> str:
    """Short display prefix for range labels."""
    import datetime

    if config.sort_by == "char":
        # Use char_count chars from name
        return file_info.name[:config.char_count].upper()
    elif config.sort_by.startswith("date_modified") or config.sort_by.startswith("date_created"):
        is_mod = config.sort_by.startswith("date_modified")
        ts = file_info.date_modified if is_mod else file_info.date_created
        dt = datetime.datetime.fromtimestamp(ts)
        if "_month" in config.sort_by:
            return dt.strftime("%Y-%m")
        elif "_year" in config.sort_by:
            return dt.strftime("%Y")
        else:
            return dt.strftime("%Y-%m-%d")
    else:
        # Full name — show first 8 chars
        return file_info.name_no_ext[:8]


def _count_folders(folders: list[PlannedFolder]) -> int:
    """Recursively count all folders in the plan."""
    count = 0
    for f in folders:
        count += 1
        if f.children:
            count += _count_folders(f.children)
    return count
