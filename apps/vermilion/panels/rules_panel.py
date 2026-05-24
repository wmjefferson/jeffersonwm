"""
Rules Panel — Dynamic add/remove/reorder rule blocks for both
rename components and file filters (extension, size, date).

Each rule block is a collapsible frame with type-specific controls.
"""

import tkinter as tk
from tkinter import ttk
from dataclasses import dataclass, field

from core.renamer import RenameComponent


# ── Extension categories ──────────────────────────────────────────────────
EXTENSION_CATEGORIES = {
    "Web Images":    {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"},
    "RAW Photos":    {".raw", ".cr2", ".nef", ".arw", ".dng"},
    "Design Files":  {".psd", ".exr"},
    "Apple Formats": {".heic", ".heif"},
    "Legacy/Other":  {".bmp", ".tiff", ".tif", ".ico"},
}

SEPARATORS = {
    "Underscore (_)": "_",
    "Hyphen (-)":     "-",
    "Space ( )":      " ",
    "Dot (.)":        ".",
    "None":           "",
}

DATE_FORMATS = {
    "YYYYMMDD":   "%Y%m%d",
    "YYYY-MM-DD": "%Y-%m-%d",
    "MMDDYYYY":   "%m%d%Y",
    "DD-MM-YYYY": "%d-%m-%Y",
}

SIZE_UNITS = {"Bytes": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}

# Rule type labels for the "Add Rule" menu
RULE_TYPES = {
    "Rename: Original Filename":  "rename_original",
    "Rename: Custom Text":        "rename_text",
    "Rename: Sequence Number":    "rename_sequence",
    "Rename: Date":               "rename_date",
    "Filter: File Extensions":    "filter_extension",
    "Filter: File Size":          "filter_size",
    "Filter: Date Range":         "filter_date",
}


# ── Filter data structure ─────────────────────────────────────────────────

@dataclass
class FilterConfig:
    """Describes one active filter rule."""
    kind: str              # 'extension', 'size', 'date'
    action: str = "ignore" # 'ignore' or 'move'
    folder_name: str = ""  # destination folder when action == 'move'
    # Extension filter
    extensions: set = field(default_factory=set)
    # Size filter
    size_mode: str = "above"    # 'above', 'below', 'between'
    size_min: int = 0           # in bytes
    size_max: int = 0           # in bytes
    # Date filter
    date_field: str = "modified"  # 'modified' or 'created'
    date_mode: str = "before"     # 'before', 'after', 'between'
    date_from: str = ""           # YYYY-MM-DD string
    date_to: str = ""             # YYYY-MM-DD string


# ══════════════════════════════════════════════════════════════════════════
# Individual rule block widgets
# ══════════════════════════════════════════════════════════════════════════

class RuleBlock(ttk.Frame):
    """Base class for a single rule block."""

    def __init__(self, parent, rule_type: str, label: str,
                 on_remove=None, on_move_up=None, on_move_down=None, **kw):
        super().__init__(parent, **kw)
        self.rule_type = rule_type
        self._on_remove = on_remove
        self._on_move_up = on_move_up
        self._on_move_down = on_move_down

        self.enabled_var = tk.BooleanVar(value=True)

        # ── Header bar ────────────────────────────────────────────────
        header = ttk.Frame(self)
        header.pack(fill="x")

        ttk.Checkbutton(
            header, text=label, variable=self.enabled_var,
            style="Panel.TCheckbutton",
        ).pack(side="left")

        # Control buttons (right-aligned)
        btn_frame = ttk.Frame(header)
        btn_frame.pack(side="right")

        ttk.Button(btn_frame, text="▲", width=3,
                   command=self._do_move_up).pack(side="left", padx=1)
        ttk.Button(btn_frame, text="▼", width=3,
                   command=self._do_move_down).pack(side="left", padx=1)
        ttk.Button(btn_frame, text="✕", width=3,
                   command=self._do_remove,
                   style="Cancel.TButton").pack(side="left", padx=(4, 0))

        # ── Content area (subclasses populate this) ───────────────────
        self.content = ttk.Frame(self)
        self.content.pack(fill="x", padx=(20, 0), pady=(4, 0))

        # ── Bottom separator ──────────────────────────────────────────
        ttk.Separator(self, orient="horizontal").pack(fill="x", pady=(8, 4))

    def _do_remove(self):
        if self._on_remove:
            self._on_remove(self)

    def _do_move_up(self):
        if self._on_move_up:
            self._on_move_up(self)

    def _do_move_down(self):
        if self._on_move_down:
            self._on_move_down(self)


class RenameOriginalBlock(RuleBlock):
    """Rename component: keep original filename."""

    def __init__(self, parent, **kw):
        super().__init__(parent, "rename_original", "Original Filename", **kw)
        ttk.Label(self.content, text="Inserts the original filename (without extension)",
                  style="Dim.TLabel").pack(anchor="w")

    def get_component(self) -> RenameComponent:
        return RenameComponent(kind="original", enabled=self.enabled_var.get())


class RenameTextBlock(RuleBlock):
    """Rename component: custom text."""

    def __init__(self, parent, **kw):
        super().__init__(parent, "rename_text", "Custom Text", **kw)
        row = ttk.Frame(self.content)
        row.pack(fill="x")
        ttk.Label(row, text="Text:", style="Panel.TLabel").pack(side="left")
        self.text_var = tk.StringVar(value="")
        ttk.Entry(row, textvariable=self.text_var, width=24).pack(
            side="left", padx=(6, 0),
        )

    def get_component(self) -> RenameComponent:
        return RenameComponent(
            kind="text", enabled=self.enabled_var.get(),
            text=self.text_var.get(),
        )


class RenameSequenceBlock(RuleBlock):
    """Rename component: sequence number."""

    def __init__(self, parent, **kw):
        super().__init__(parent, "rename_sequence", "Sequence Number", **kw)
        row = ttk.Frame(self.content)
        row.pack(fill="x")

        ttk.Label(row, text="Start:", style="Panel.TLabel").pack(side="left")
        self.start_var = tk.IntVar(value=1)
        ttk.Spinbox(row, textvariable=self.start_var, from_=0, to=999999,
                     width=7).pack(side="left", padx=(4, 14))

        ttk.Label(row, text="Digits:", style="Panel.TLabel").pack(side="left")
        self.digits_var = tk.IntVar(value=3)
        ttk.Spinbox(row, textvariable=self.digits_var, from_=0, to=8,
                     width=4).pack(side="left", padx=(4, 10))

        ttk.Label(row, text="(0 = no padding)", style="Dim.TLabel").pack(
            side="left",
        )

    def get_component(self) -> RenameComponent:
        return RenameComponent(
            kind="sequence", enabled=self.enabled_var.get(),
            seq_start=self.start_var.get(),
            seq_digits=self.digits_var.get(),
        )


class RenameDateBlock(RuleBlock):
    """Rename component: date from file metadata."""

    def __init__(self, parent, **kw):
        super().__init__(parent, "rename_date", "Date", **kw)
        row = ttk.Frame(self.content)
        row.pack(fill="x")

        ttk.Label(row, text="Format:", style="Panel.TLabel").pack(side="left")
        self.format_var = tk.StringVar(value="YYYYMMDD")
        ttk.Combobox(row, textvariable=self.format_var,
                     values=list(DATE_FORMATS.keys()), state="readonly",
                     width=14).pack(side="left", padx=(6, 0))

    def get_component(self) -> RenameComponent:
        fmt_label = self.format_var.get()
        return RenameComponent(
            kind="date", enabled=self.enabled_var.get(),
            date_format=DATE_FORMATS.get(fmt_label, "%Y%m%d"),
        )


# ── Filter blocks ─────────────────────────────────────────────────────────

class FilterExtensionBlock(RuleBlock):
    """Filter: route or ignore files by extension category."""

    def __init__(self, parent, **kw):
        super().__init__(parent, "filter_extension", "Filter: File Extensions", **kw)

        # Action row
        act_row = ttk.Frame(self.content)
        act_row.pack(fill="x", pady=(0, 6))

        self.action_var = tk.StringVar(value="ignore")
        ttk.Radiobutton(act_row, text="Ignore", variable=self.action_var,
                        value="ignore", style="Panel.TRadiobutton").pack(
                            side="left")
        ttk.Radiobutton(act_row, text="Move to folder:",
                        variable=self.action_var, value="move",
                        style="Panel.TRadiobutton").pack(side="left", padx=(10, 4))
        self.folder_var = tk.StringVar(value="RAW")
        ttk.Entry(act_row, textvariable=self.folder_var, width=16).pack(
            side="left",
        )

        # Category checkboxes
        self.cat_vars: dict[str, tk.BooleanVar] = {}
        for cat_name in EXTENSION_CATEGORIES:
            exts_str = " ".join(sorted(EXTENSION_CATEGORIES[cat_name]))
            var = tk.BooleanVar(value=False)
            self.cat_vars[cat_name] = var
            ttk.Checkbutton(
                self.content,
                text=f"{cat_name}  ({exts_str})",
                variable=var, style="Panel.TCheckbutton",
            ).pack(anchor="w", pady=1)

    def get_filter(self) -> FilterConfig | None:
        if not self.enabled_var.get():
            return None
        exts = set()
        for cat_name, var in self.cat_vars.items():
            if var.get():
                exts.update(EXTENSION_CATEGORIES[cat_name])
        if not exts:
            return None
        return FilterConfig(
            kind="extension",
            action=self.action_var.get(),
            folder_name=self.folder_var.get().strip() or "FILTERED",
            extensions=exts,
        )


class FilterSizeBlock(RuleBlock):
    """Filter: route or ignore files by size range."""

    def __init__(self, parent, **kw):
        super().__init__(parent, "filter_size", "Filter: File Size", **kw)

        # Action row
        act_row = ttk.Frame(self.content)
        act_row.pack(fill="x", pady=(0, 6))

        self.action_var = tk.StringVar(value="ignore")
        ttk.Radiobutton(act_row, text="Ignore", variable=self.action_var,
                        value="ignore", style="Panel.TRadiobutton").pack(
                            side="left")
        ttk.Radiobutton(act_row, text="Move to folder:",
                        variable=self.action_var, value="move",
                        style="Panel.TRadiobutton").pack(side="left", padx=(10, 4))
        self.folder_var = tk.StringVar(value="LARGE_FILES")
        ttk.Entry(act_row, textvariable=self.folder_var, width=16).pack(
            side="left",
        )

        # Mode
        mode_row = ttk.Frame(self.content)
        mode_row.pack(fill="x", pady=(0, 4))

        self.mode_var = tk.StringVar(value="above")
        for val, label in [("above", "Above"), ("below", "Below"),
                           ("between", "Between")]:
            ttk.Radiobutton(mode_row, text=label, variable=self.mode_var,
                            value=val, style="Panel.TRadiobutton").pack(
                                side="left", padx=(0, 8))

        # Values
        val_row = ttk.Frame(self.content)
        val_row.pack(fill="x")

        ttk.Label(val_row, text="Min:", style="Panel.TLabel").pack(side="left")
        self.min_var = tk.StringVar(value="0")
        ttk.Entry(val_row, textvariable=self.min_var, width=8).pack(
            side="left", padx=(4, 8),
        )

        ttk.Label(val_row, text="Max:", style="Panel.TLabel").pack(side="left")
        self.max_var = tk.StringVar(value="0")
        ttk.Entry(val_row, textvariable=self.max_var, width=8).pack(
            side="left", padx=(4, 8),
        )

        self.unit_var = tk.StringVar(value="MB")
        ttk.Combobox(val_row, textvariable=self.unit_var,
                     values=list(SIZE_UNITS.keys()), state="readonly",
                     width=6).pack(side="left")

    def get_filter(self) -> FilterConfig | None:
        if not self.enabled_var.get():
            return None
        try:
            multiplier = SIZE_UNITS.get(self.unit_var.get(), 1)
            min_val = float(self.min_var.get()) * multiplier
            max_val = float(self.max_var.get()) * multiplier
        except ValueError:
            return None
        return FilterConfig(
            kind="size",
            action=self.action_var.get(),
            folder_name=self.folder_var.get().strip() or "FILTERED",
            size_mode=self.mode_var.get(),
            size_min=int(min_val),
            size_max=int(max_val),
        )


class FilterDateBlock(RuleBlock):
    """Filter: route or ignore files by date range."""

    def __init__(self, parent, **kw):
        super().__init__(parent, "filter_date", "Filter: Date Range", **kw)

        # Action row
        act_row = ttk.Frame(self.content)
        act_row.pack(fill="x", pady=(0, 6))

        self.action_var = tk.StringVar(value="ignore")
        ttk.Radiobutton(act_row, text="Ignore", variable=self.action_var,
                        value="ignore", style="Panel.TRadiobutton").pack(
                            side="left")
        ttk.Radiobutton(act_row, text="Move to folder:",
                        variable=self.action_var, value="move",
                        style="Panel.TRadiobutton").pack(side="left", padx=(10, 4))
        self.folder_var = tk.StringVar(value="OLD_PHOTOS")
        ttk.Entry(act_row, textvariable=self.folder_var, width=16).pack(
            side="left",
        )

        # Date field
        field_row = ttk.Frame(self.content)
        field_row.pack(fill="x", pady=(0, 4))

        ttk.Label(field_row, text="Field:", style="Panel.TLabel").pack(
            side="left",
        )
        self.field_var = tk.StringVar(value="modified")
        ttk.Combobox(field_row, textvariable=self.field_var,
                     values=["modified", "created"], state="readonly",
                     width=10).pack(side="left", padx=(4, 12))

        self.mode_var = tk.StringVar(value="before")
        for val, label in [("before", "Before"), ("after", "After"),
                           ("between", "Between")]:
            ttk.Radiobutton(field_row, text=label, variable=self.mode_var,
                            value=val, style="Panel.TRadiobutton").pack(
                                side="left", padx=(0, 6))

        # Date inputs
        date_row = ttk.Frame(self.content)
        date_row.pack(fill="x")

        ttk.Label(date_row, text="From:", style="Panel.TLabel").pack(
            side="left",
        )
        self.from_var = tk.StringVar(value="2020-01-01")
        ttk.Entry(date_row, textvariable=self.from_var, width=12).pack(
            side="left", padx=(4, 10),
        )

        ttk.Label(date_row, text="To:", style="Panel.TLabel").pack(
            side="left",
        )
        self.to_var = tk.StringVar(value="2025-12-31")
        ttk.Entry(date_row, textvariable=self.to_var, width=12).pack(
            side="left", padx=(4, 0),
        )

        ttk.Label(date_row, text="(YYYY-MM-DD)", style="Dim.TLabel").pack(
            side="left", padx=(8, 0),
        )

    def get_filter(self) -> FilterConfig | None:
        if not self.enabled_var.get():
            return None
        return FilterConfig(
            kind="date",
            action=self.action_var.get(),
            folder_name=self.folder_var.get().strip() or "FILTERED",
            date_field=self.field_var.get(),
            date_mode=self.mode_var.get(),
            date_from=self.from_var.get().strip(),
            date_to=self.to_var.get().strip(),
        )


# ══════════════════════════════════════════════════════════════════════════
# Block factory
# ══════════════════════════════════════════════════════════════════════════

BLOCK_CLASSES = {
    "rename_original":   RenameOriginalBlock,
    "rename_text":       RenameTextBlock,
    "rename_sequence":   RenameSequenceBlock,
    "rename_date":       RenameDateBlock,
    "filter_extension":  FilterExtensionBlock,
    "filter_size":       FilterSizeBlock,
    "filter_date":       FilterDateBlock,
}


# ══════════════════════════════════════════════════════════════════════════
# Main Rules Panel
# ══════════════════════════════════════════════════════════════════════════

class RulesPanel(ttk.LabelFrame):
    """Dynamic rules panel: add, remove, and reorder rename + filter blocks."""

    def __init__(self, parent, **kwargs):
        super().__init__(
            parent, text="  Rules & Filters  ", padding=(14, 10), **kwargs,
        )
        self.blocks: list[RuleBlock] = []
        self._build_ui()

    def _build_ui(self):
        # ── Top: enable rename + separator ────────────────────────────
        top = ttk.Frame(self)
        top.pack(fill="x", pady=(0, 6))

        self.rename_enabled_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            top, text="Enable batch rename", variable=self.rename_enabled_var,
            style="Panel.TCheckbutton",
        ).pack(side="left")

        # Separator
        sep_frame = ttk.Frame(top)
        sep_frame.pack(side="right")
        ttk.Label(sep_frame, text="Separator:", style="Panel.TLabel").pack(
            side="left",
        )
        self.separator_var = tk.StringVar(value="Underscore (_)")
        ttk.Combobox(sep_frame, textvariable=self.separator_var,
                     values=list(SEPARATORS.keys()), state="readonly",
                     width=14).pack(side="left", padx=(4, 0))

        # ── Rename preview ────────────────────────────────────────────
        prev_frame = ttk.Frame(self)
        prev_frame.pack(fill="x", pady=(0, 8))
        ttk.Label(prev_frame, text="Rename preview:", style="Panel.TLabel").pack(
            side="left",
        )
        self.preview_label = ttk.Label(
            prev_frame, text="—", style="Dim.TLabel",
            font=("Cascadia Code", 9),
        )
        self.preview_label.pack(side="left", padx=(6, 0))

        ttk.Separator(self, orient="horizontal").pack(fill="x", pady=(0, 8))

        # ── Scrollable blocks area ────────────────────────────────────
        blocks_outer = ttk.Frame(self)
        blocks_outer.pack(fill="both", expand=True)

        self._blocks_canvas = tk.Canvas(
            blocks_outer, highlightthickness=0, height=200,
        )
        blocks_scroll = ttk.Scrollbar(
            blocks_outer, orient="vertical",
            command=self._blocks_canvas.yview,
        )
        self._blocks_canvas.configure(yscrollcommand=blocks_scroll.set)
        blocks_scroll.pack(side="right", fill="y")
        self._blocks_canvas.pack(side="left", fill="both", expand=True)

        self._blocks_frame = ttk.Frame(self._blocks_canvas)
        self._blocks_canvas_window = self._blocks_canvas.create_window(
            (0, 0), window=self._blocks_frame, anchor="nw",
        )
        self._blocks_frame.bind(
            "<Configure>",
            lambda e: self._blocks_canvas.configure(
                scrollregion=self._blocks_canvas.bbox("all"),
            ),
        )
        self._blocks_canvas.bind(
            "<Configure>",
            lambda e: self._blocks_canvas.itemconfigure(
                self._blocks_canvas_window, width=e.width,
            ),
        )

        # ── Add Rule button ───────────────────────────────────────────
        add_frame = ttk.Frame(self)
        add_frame.pack(fill="x", pady=(8, 0))

        self.add_type_var = tk.StringVar(value=list(RULE_TYPES.keys())[0])
        ttk.Combobox(
            add_frame, textvariable=self.add_type_var,
            values=list(RULE_TYPES.keys()), state="readonly", width=30,
        ).pack(side="left", padx=(0, 6))

        ttk.Button(
            add_frame, text="+ Add Rule", style="Accent.TButton",
            command=self._add_rule,
        ).pack(side="left")

    # ── Block management ──────────────────────────────────────────────

    def _add_rule(self):
        """Add a new rule block of the selected type."""
        label = self.add_type_var.get()
        rule_type = RULE_TYPES.get(label)
        if not rule_type:
            return
        block_cls = BLOCK_CLASSES.get(rule_type)
        if not block_cls:
            return

        block = block_cls(
            self._blocks_frame,
            on_remove=self._remove_block,
            on_move_up=self._move_block_up,
            on_move_down=self._move_block_down,
        )
        self.blocks.append(block)
        block.pack(fill="x", pady=(0, 2))

    def _remove_block(self, block: RuleBlock):
        if block in self.blocks:
            self.blocks.remove(block)
            block.destroy()

    def _move_block_up(self, block: RuleBlock):
        idx = self.blocks.index(block)
        if idx > 0:
            self.blocks[idx], self.blocks[idx - 1] = (
                self.blocks[idx - 1], self.blocks[idx]
            )
            self._repack_blocks()

    def _move_block_down(self, block: RuleBlock):
        idx = self.blocks.index(block)
        if idx < len(self.blocks) - 1:
            self.blocks[idx], self.blocks[idx + 1] = (
                self.blocks[idx + 1], self.blocks[idx]
            )
            self._repack_blocks()

    def _repack_blocks(self):
        """Re-pack all blocks in current order."""
        for block in self.blocks:
            block.pack_forget()
        for block in self.blocks:
            block.pack(fill="x", pady=(0, 2))

    # ── Public getters ────────────────────────────────────────────────

    def is_rename_enabled(self) -> bool:
        return self.rename_enabled_var.get()

    def get_separator(self) -> str:
        return SEPARATORS.get(self.separator_var.get(), "_")

    def get_rename_components(self) -> list[RenameComponent]:
        """Return rename components from all rename blocks, in order."""
        comps = []
        for block in self.blocks:
            if hasattr(block, "get_component"):
                comps.append(block.get_component())
        return comps

    def get_filters(self) -> list[FilterConfig]:
        """Return active filter configs from all filter blocks, in order."""
        filters = []
        for block in self.blocks:
            if hasattr(block, "get_filter"):
                fc = block.get_filter()
                if fc:
                    filters.append(fc)
        return filters

    def update_preview(self, example_name: str):
        self.preview_label.configure(text=example_name)
