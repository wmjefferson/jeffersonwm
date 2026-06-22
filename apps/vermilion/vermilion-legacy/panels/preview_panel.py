"""
Preview Panel — Treeview showing the planned folder structure,
summary statistics, export, duplicate warnings, and action buttons.
Styled for dark theme.
"""

import os
import tkinter as tk
from tkinter import ttk, filedialog

from core.planner import Plan, PlannedFolder


MAX_FILES_SHOWN = 25  # cap file listing per folder to keep tree snappy


class PreviewPanel(ttk.LabelFrame):
    """Right-side panel: preview tree + action buttons."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, text="  Preview  ", padding=(14, 10), **kwargs)
        self._current_plan = None
        self._build_ui()

    def _build_ui(self):
        # -- Treeview -------------------------------------------------------
        tree_frame = ttk.Frame(self)
        tree_frame.pack(fill="both", expand=True)

        self.tree = ttk.Treeview(tree_frame, show="tree", selectmode="none")
        self.tree.pack(side="left", fill="both", expand=True)

        scrollbar = ttk.Scrollbar(
            tree_frame, orient="vertical", command=self.tree.yview,
        )
        scrollbar.pack(side="right", fill="y")
        self.tree.configure(yscrollcommand=scrollbar.set)

        # -- Duplicate warning ----------------------------------------------
        self.dup_var = tk.StringVar(value="")
        self.dup_label = ttk.Label(
            self, textvariable=self.dup_var,
            foreground="#f9e2af",  # yellow warning
            font=("Segoe UI", 8),
        )
        self.dup_label.pack(fill="x", pady=(6, 0))

        # -- Summary --------------------------------------------------------
        self.summary_var = tk.StringVar(
            value="Select a source directory and click Preview.",
        )
        summary_label = ttk.Label(
            self, textvariable=self.summary_var,
            style="Dim.TLabel", wraplength=500, justify="left",
        )
        summary_label.pack(fill="x", pady=(4, 0))

        # -- Progress bar ---------------------------------------------------
        self.progress_var = tk.DoubleVar(value=0)
        self.progress_bar = ttk.Progressbar(
            self, variable=self.progress_var, maximum=100,
        )
        self.progress_bar.pack(fill="x", pady=(10, 0))

        # -- Status label ---------------------------------------------------
        self.status_var = tk.StringVar(value="Ready")
        self.status_label = ttk.Label(
            self, textvariable=self.status_var, style="Dim.TLabel",
        )
        self.status_label.pack(fill="x", pady=(4, 0))

        # -- Buttons --------------------------------------------------------
        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill="x", pady=(12, 0))

        self.preview_btn = ttk.Button(
            btn_frame, text="🔍  Preview", style="Accent.TButton",
        )
        self.preview_btn.pack(side="left", padx=(0, 8))

        self.execute_btn = ttk.Button(
            btn_frame, text="▶  Execute", style="Execute.TButton",
        )
        self.execute_btn.pack(side="left", padx=(0, 8))

        self.export_btn = ttk.Button(
            btn_frame, text="📄 Export", command=self._on_export,
        )
        self.export_btn.pack(side="left", padx=(0, 8))

        self.cancel_btn = ttk.Button(
            btn_frame, text="Cancel", style="Cancel.TButton",
        )
        self.cancel_btn.pack(side="right")

    # -- Public methods -----------------------------------------------------

    def display_plan(self, plan: Plan):
        """Populate the tree with the given Plan."""
        self._current_plan = plan
        self.tree.delete(*self.tree.get_children())

        # Root node
        root_id = self.tree.insert("", "end", text=f"📁  {plan.root_path}")

        # Image folders
        for folder in plan.folders:
            self._insert_folder(root_id, folder)

        # Non-image folder
        if plan.non_image_folder:
            ni = plan.non_image_folder
            ni_id = self.tree.insert(
                root_id, "end",
                text=f"📁  {ni.display_name}",
            )
            self._insert_files(ni_id, ni.files)

        # Filter folders
        for ff in plan.filter_folders:
            ff_id = self.tree.insert(
                root_id, "end",
                text=f"📁  {ff.display_name}",
            )
            self._insert_files(ff_id, ff.files)

        # Expand root and first level
        self.tree.item(root_id, open=True)
        for child_id in self.tree.get_children(root_id):
            self.tree.item(child_id, open=True)

        # Duplicate detection
        self._check_duplicates(plan)

        # Summary
        filtered_str = ""
        if plan.total_filtered > 0:
            filtered_str = f"   |   Filtered: {plan.total_filtered}"
        self.summary_var.set(
            f"Total images: {plan.total_images}  →  "
            f"{plan.total_folders} folder(s)   |   "
            f"Non-image: {plan.total_non_images}"
            f"{filtered_str}"
        )

    def _insert_folder(self, parent_id: str, folder: PlannedFolder):
        folder_id = self.tree.insert(
            parent_id, "end",
            text=f"📁  {folder.display_name}",
        )
        for child in folder.children:
            self._insert_folder(folder_id, child)
        self._insert_files(folder_id, folder.files)

    def _insert_files(self, parent_id: str, files: list):
        shown = files[:MAX_FILES_SHOWN]
        remaining = len(files) - len(shown)

        for pf in shown:
            display = pf.new_name
            if pf.new_name != pf.original_name:
                display = f"{pf.original_name}  →  {pf.new_name}"
            self.tree.insert(parent_id, "end", text=f"    📄  {display}")

        if remaining > 0:
            self.tree.insert(
                parent_id, "end",
                text=f"    ⋯  and {remaining} more file(s)",
            )

    def _check_duplicates(self, plan: Plan):
        """Detect files with identical destination names and warn."""
        all_dest_names: dict[str, list[str]] = {}

        def _collect(folders):
            for folder in folders:
                for pf in folder.files:
                    dest_full = os.path.join(pf.destination_dir, pf.new_name)
                    all_dest_names.setdefault(pf.new_name, []).append(dest_full)
                if folder.children:
                    _collect(folder.children)

        _collect(plan.folders)
        if plan.non_image_folder:
            for pf in plan.non_image_folder.files:
                all_dest_names.setdefault(pf.new_name, []).append(
                    os.path.join(pf.destination_dir, pf.new_name)
                )
        _collect(plan.filter_folders)

        dupes = {name: paths for name, paths in all_dest_names.items()
                 if len(paths) > 1}

        if dupes:
            count = sum(len(p) for p in dupes.values())
            self.dup_var.set(
                f"⚠ {len(dupes)} duplicate filename(s) detected "
                f"({count} files total) — conflicts may occur"
            )
        else:
            self.dup_var.set("")

    def _on_export(self):
        """Export the current plan as a text file."""
        if not self._current_plan:
            return

        path = filedialog.asksaveasfilename(
            title="Export Plan",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("CSV files", "*.csv"),
                       ("All files", "*.*")],
            initialfile="file_organizer_plan.txt",
        )
        if not path:
            return

        plan = self._current_plan
        is_csv = path.lower().endswith(".csv")

        with open(path, "w", encoding="utf-8") as f:
            if is_csv:
                f.write("Folder,Original Name,New Name,Source Path,Destination\n")
                self._export_csv(f, plan)
            else:
                f.write(f"File Organizer Plan\n")
                f.write(f"{'=' * 60}\n")
                f.write(f"Destination: {plan.root_path}\n")
                f.write(f"Images: {plan.total_images}  |  "
                        f"Folders: {plan.total_folders}  |  "
                        f"Non-image: {plan.total_non_images}  |  "
                        f"Filtered: {plan.total_filtered}\n")
                f.write(f"{'=' * 60}\n\n")
                self._export_text(f, plan)

        self.set_status(f"Plan exported to {os.path.basename(path)}")

    def _export_text(self, f, plan: Plan):
        def _write_folder(folder, indent=0):
            prefix = "  " * indent
            f.write(f"{prefix}📁 {folder.display_name}\n")
            for child in folder.children:
                _write_folder(child, indent + 1)
            for pf in folder.files:
                arrow = f"{pf.original_name} → {pf.new_name}" \
                    if pf.new_name != pf.original_name else pf.new_name
                f.write(f"{prefix}  📄 {arrow}\n")

        for folder in plan.folders:
            _write_folder(folder)
            f.write("\n")

        if plan.non_image_folder:
            _write_folder(plan.non_image_folder)
            f.write("\n")

        for ff in plan.filter_folders:
            _write_folder(ff)
            f.write("\n")

    def _export_csv(self, f, plan: Plan):
        def _write_folder(folder):
            for pf in folder.files:
                f.write(f'"{folder.display_name}","{pf.original_name}",'
                        f'"{pf.new_name}","{pf.source_path}",'
                        f'"{pf.destination_dir}"\n')
            for child in folder.children:
                _write_folder(child)

        for folder in plan.folders:
            _write_folder(folder)
        if plan.non_image_folder:
            _write_folder(plan.non_image_folder)
        for ff in plan.filter_folders:
            _write_folder(ff)

    def set_progress(self, current: int, total: int, filename: str = ""):
        if total > 0:
            pct = (current / total) * 100
            self.progress_var.set(pct)
        self.status_var.set(f"Processing {current}/{total}: {filename}")

    def set_status(self, text: str):
        self.status_var.set(text)
        self.progress_var.set(0)
