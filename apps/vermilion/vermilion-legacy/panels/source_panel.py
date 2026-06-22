"""
Source Panel — source/destination directory selection, move/copy toggle,
conflict handling, recursive scanning, merge, live file count,
recent directories, and clipboard paste support.
Styled for dark theme.
"""

import os
import tkinter as tk
from tkinter import ttk, filedialog

from utils import IMAGE_EXTENSIONS
from core.recents import (
    get_recent_sources, get_recent_dests,
    add_recent_source, add_recent_dest,
)


class SourcePanel(ttk.LabelFrame):
    """Top-left panel: source & destination directory pickers."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, text="  Source & Destination  ", padding=(14, 10), **kwargs)
        self._build_ui()

    def _build_ui(self):
        # -- Source directory -----------------------------------------------
        row = 0
        ttk.Label(self, text="Source Directory  (new files):", style="Panel.TLabel").grid(
            row=row, column=0, sticky="w", pady=(0, 3),
        )

        row += 1
        self.source_var = tk.StringVar()
        src_frame = ttk.Frame(self)
        src_frame.grid(row=row, column=0, sticky="ew", pady=(0, 3))
        src_frame.columnconfigure(0, weight=1)

        self.source_entry = ttk.Combobox(
            src_frame, textvariable=self.source_var,
            values=get_recent_sources(), width=40,
        )
        self.source_entry.grid(row=0, column=0, sticky="ew", padx=(0, 4))
        ttk.Button(
            src_frame, text="📋", width=3,
            command=self._paste_source,
        ).grid(row=0, column=1, padx=(0, 4))
        ttk.Button(
            src_frame, text="Browse…", width=10,
            command=self._browse_source, style="Accent.TButton",
        ).grid(row=0, column=2)

        # Quick file count
        row += 1
        self.count_var = tk.StringVar(value="")
        self.count_label = ttk.Label(
            self, textvariable=self.count_var, style="Dim.TLabel",
            font=("Cascadia Code", 8),
        )
        self.count_label.grid(row=row, column=0, sticky="w", pady=(0, 8))
        self.source_var.trace_add("write", self._on_source_changed)

        # -- Destination directory ------------------------------------------
        row += 1
        ttk.Label(self, text="Destination Directory:", style="Panel.TLabel").grid(
            row=row, column=0, sticky="w", pady=(0, 3),
        )

        row += 1
        self.dest_var = tk.StringVar()
        dst_frame = ttk.Frame(self)
        dst_frame.grid(row=row, column=0, sticky="ew", pady=(0, 10))
        dst_frame.columnconfigure(0, weight=1)

        self.dest_entry = ttk.Combobox(
            dst_frame, textvariable=self.dest_var,
            values=get_recent_dests(), width=40,
        )
        self.dest_entry.grid(row=0, column=0, sticky="ew", padx=(0, 4))
        ttk.Button(
            dst_frame, text="📋", width=3,
            command=self._paste_dest,
        ).grid(row=0, column=1, padx=(0, 4))
        self.dest_browse_btn = ttk.Button(
            dst_frame, text="Browse…", width=10, command=self._browse_dest,
            style="Accent.TButton",
        )
        self.dest_browse_btn.grid(row=0, column=2)

        # -- Drop zone hint ------------------------------------------------
        row += 1
        self.drop_label = ttk.Label(
            self,
            text="💡 Tip: Paste a folder path with 📋 or type/browse above",
            style="Dim.TLabel", font=("Segoe UI", 8),
        )
        self.drop_label.grid(row=row, column=0, sticky="w", pady=(0, 6))

        # -- Overwrite in place ---------------------------------------------
        row += 1
        self.overwrite_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            self, text="Output in place (overwrite source structure)",
            variable=self.overwrite_var, command=self._toggle_overwrite,
            style="Panel.TCheckbutton",
        ).grid(row=row, column=0, sticky="w", pady=(0, 6))

        # -- Merge into destination -----------------------------------------
        row += 1
        self.merge_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            self, text="Merge into destination  (add source files to existing organised folder)",
            variable=self.merge_var,
            style="Panel.TCheckbutton",
        ).grid(row=row, column=0, sticky="w", pady=(0, 10))

        # -- Options row: Move/Copy + Conflict + Recursive ------------------
        row += 1
        opts = ttk.Frame(self)
        opts.grid(row=row, column=0, sticky="ew")

        ttk.Label(opts, text="Operation:", style="Panel.TLabel").pack(side="left")
        self.operation_var = tk.StringVar(value="copy")
        ttk.Radiobutton(
            opts, text="Copy", variable=self.operation_var, value="copy",
            style="Panel.TRadiobutton",
        ).pack(side="left", padx=(8, 2))
        ttk.Radiobutton(
            opts, text="Move", variable=self.operation_var, value="move",
            style="Panel.TRadiobutton",
        ).pack(side="left", padx=(2, 20))

        ttk.Label(opts, text="Conflicts:", style="Panel.TLabel").pack(side="left")
        self.conflict_var = tk.StringVar(value="skip")
        ttk.Combobox(
            opts, textvariable=self.conflict_var, width=12,
            values=["skip", "overwrite", "auto_rename"], state="readonly",
        ).pack(side="left", padx=(8, 20))

        self.recursive_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            opts, text="Include subfolders",
            variable=self.recursive_var, style="Panel.TCheckbutton",
        ).pack(side="left")

        self.columnconfigure(0, weight=1)

    # -- Callbacks ----------------------------------------------------------

    def _browse_source(self):
        path = filedialog.askdirectory(title="Select Source Directory")
        if path:
            self.source_var.set(path)
            add_recent_source(path)
            self.source_entry.configure(values=get_recent_sources())

    def _browse_dest(self):
        path = filedialog.askdirectory(title="Select Destination Directory")
        if path:
            self.dest_var.set(path)
            add_recent_dest(path)
            self.dest_entry.configure(values=get_recent_dests())

    def _paste_source(self):
        try:
            text = self.clipboard_get().strip().strip('"')
            if os.path.isdir(text):
                self.source_var.set(text)
                add_recent_source(text)
                self.source_entry.configure(values=get_recent_sources())
        except tk.TclError:
            pass

    def _paste_dest(self):
        try:
            text = self.clipboard_get().strip().strip('"')
            if os.path.isdir(text):
                self.dest_var.set(text)
                add_recent_dest(text)
                self.dest_entry.configure(values=get_recent_dests())
        except tk.TclError:
            pass

    def _toggle_overwrite(self):
        state = "disabled" if self.overwrite_var.get() else "normal"
        self.dest_entry.configure(state=state)
        self.dest_browse_btn.configure(state=state)

    def _on_source_changed(self, *_args):
        path = self.source_var.get().strip()
        if not path or not os.path.isdir(path):
            self.count_var.set("")
            return
        try:
            img_count = 0
            other_count = 0
            for root, _dirs, files in os.walk(path):
                for fname in files:
                    ext = os.path.splitext(fname)[1].lower()
                    if ext in IMAGE_EXTENSIONS:
                        img_count += 1
                    else:
                        other_count += 1
                if not self.recursive_var.get():
                    break
            parts = [f"📊  {img_count} images"]
            if other_count > 0:
                parts.append(f"{other_count} other")
            self.count_var.set("  |  ".join(parts))
        except OSError:
            self.count_var.set("")

    # -- Public getters -----------------------------------------------------

    def get_source(self) -> str:
        return self.source_var.get().strip()

    def get_dest(self) -> str:
        if self.overwrite_var.get():
            return self.get_source()
        return self.dest_var.get().strip()

    def get_operation(self) -> str:
        return self.operation_var.get()

    def get_conflict(self) -> str:
        return self.conflict_var.get()

    def get_recursive(self) -> bool:
        return self.recursive_var.get()

    def get_merge(self) -> bool:
        return self.merge_var.get()

    def remember_paths(self):
        """Save current paths to recents (call after successful execute)."""
        src = self.get_source()
        dest = self.get_dest()
        if src and os.path.isdir(src):
            add_recent_source(src)
            self.source_entry.configure(values=get_recent_sources())
        if dest:
            add_recent_dest(dest)
            self.dest_entry.configure(values=get_recent_dests())
