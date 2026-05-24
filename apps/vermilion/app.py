"""
Vermilion — Main application window.

Wires together all panels and connects them to the core logic.
Features a polished dark theme for a professional look.
"""

import os
import sys
import threading
import tkinter as tk
from tkinter import ttk, messagebox

# Ensure project root is on sys.path so relative imports work
_PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from panels.source_panel import SourcePanel
from panels.options_panel import OptionsPanel
from panels.rules_panel import RulesPanel
from panels.preview_panel import PreviewPanel

from core.scanner import scan_directory
from core.planner import generate_plan, PlanConfig
from core.renamer import build_rename_func
from core.executor import execute_plan, undo_last
from core.presets import list_presets, save_preset, load_preset


# ── Theme colours ─────────────────────────────────────────────────────────
BG_DARK       = "#1e1e2e"    # main background
BG_PANEL      = "#262637"    # panel / frame background
BG_INPUT      = "#2e2e42"    # entry / combo background
BG_TREE       = "#1a1a2a"    # treeview background
FG_MAIN       = "#cdd6f4"    # primary text
FG_DIM        = "#7f849c"    # secondary / hint text
FG_BRIGHT     = "#f5f5ff"    # headings
ACCENT        = "#89b4fa"    # accent (buttons, highlights)
ACCENT_HOVER  = "#74a8fc"
ACCENT_EXEC   = "#a6e3a1"    # execute button green
ACCENT_CANCEL = "#f38ba8"    # cancel button red
BORDER        = "#45475a"    # subtle borders
SELECT_BG     = "#313244"    # selected row background
PROGRESS_BG   = "#45475a"
PROGRESS_FG   = "#89b4fa"
CHECK_ON      = "#89b4fa"    # checkbox/radio indicator when selected
CHECK_OFF     = "#3e3e56"    # checkbox/radio indicator when deselected


def apply_dark_theme(root: tk.Tk):
    """Configure a polished dark ttk theme."""
    style = ttk.Style(root)
    style.theme_use("clam")  # clam is the most customisable base

    # ── Global ────────────────────────────────────────────────────────
    style.configure(".", background=BG_DARK, foreground=FG_MAIN,
                    fieldbackground=BG_INPUT, borderwidth=0,
                    font=("Segoe UI", 9))

    # ── Frames ────────────────────────────────────────────────────────
    style.configure("TFrame", background=BG_DARK)
    style.configure("TLabelframe", background=BG_PANEL,
                    bordercolor=BORDER, borderwidth=1, relief="flat")
    style.configure("TLabelframe.Label", background=BG_PANEL,
                    foreground=ACCENT, font=("Segoe UI Semibold", 10))

    # ── Labels ────────────────────────────────────────────────────────
    style.configure("TLabel", background=BG_DARK, foreground=FG_MAIN)
    style.configure("Panel.TLabel", background=BG_PANEL)
    style.configure("Dim.TLabel", foreground=FG_DIM)
    style.configure("Heading.TLabel", foreground=FG_BRIGHT,
                    font=("Segoe UI Semibold", 11))

    # ── Buttons ───────────────────────────────────────────────────────
    style.configure("TButton", background=BG_INPUT, foreground=FG_MAIN,
                    padding=(12, 5), borderwidth=1, relief="flat",
                    font=("Segoe UI", 9))
    style.map("TButton",
              background=[("active", ACCENT), ("pressed", ACCENT_HOVER)],
              foreground=[("active", BG_DARK), ("pressed", BG_DARK)])

    style.configure("Accent.TButton", background=ACCENT, foreground=BG_DARK,
                    font=("Segoe UI Semibold", 9), padding=(14, 6))
    style.map("Accent.TButton",
              background=[("active", ACCENT_HOVER), ("disabled", BORDER)])

    style.configure("Execute.TButton", background=ACCENT_EXEC,
                    foreground=BG_DARK, font=("Segoe UI Semibold", 9),
                    padding=(14, 6))
    style.map("Execute.TButton",
              background=[("active", "#8bd690"), ("disabled", BORDER)])

    style.configure("Cancel.TButton", background=ACCENT_CANCEL,
                    foreground=BG_DARK, font=("Segoe UI Semibold", 9),
                    padding=(14, 6))
    style.map("Cancel.TButton",
              background=[("active", "#e87595"), ("disabled", BORDER)])

    # ── Entries ───────────────────────────────────────────────────────
    style.configure("TEntry", fieldbackground=BG_INPUT, foreground=FG_MAIN,
                    insertcolor=FG_MAIN, borderwidth=1, padding=4)
    style.map("TEntry", bordercolor=[("focus", ACCENT)])

    # ── Combobox ──────────────────────────────────────────────────────
    style.configure("TCombobox", fieldbackground=BG_INPUT, foreground=FG_MAIN,
                    arrowcolor=ACCENT, padding=4)
    style.map("TCombobox",
              fieldbackground=[("readonly", BG_INPUT)],
              foreground=[("readonly", FG_MAIN)],
              bordercolor=[("focus", ACCENT)])

    # Fix combobox dropdown (requires option_add for the Listbox)
    root.option_add("*TCombobox*Listbox.background", BG_INPUT)
    root.option_add("*TCombobox*Listbox.foreground", FG_MAIN)
    root.option_add("*TCombobox*Listbox.selectBackground", ACCENT)
    root.option_add("*TCombobox*Listbox.selectForeground", BG_DARK)

    # ── Spinbox ───────────────────────────────────────────────────────
    style.configure("TSpinbox", fieldbackground=BG_INPUT, foreground=FG_MAIN,
                    arrowcolor=ACCENT, padding=4)

    # ── Checkbutton ───────────────────────────────────────────────────
    # Key fix: use both 'selected' and '!selected' states for the indicator
    # so the visual state is always clearly distinguishable.
    style.configure("TCheckbutton", background=BG_DARK, foreground=FG_MAIN,
                    indicatorbackground=CHECK_OFF, font=("Segoe UI", 9))
    style.map("TCheckbutton",
              background=[("active", BG_DARK)],
              indicatorbackground=[("selected", CHECK_ON),
                                   ("!selected", CHECK_OFF)],
              indicatorforeground=[("selected", BG_DARK),
                                   ("!selected", CHECK_OFF)])

    style.configure("Panel.TCheckbutton", background=BG_PANEL)
    style.map("Panel.TCheckbutton",
              background=[("active", BG_PANEL)],
              indicatorbackground=[("selected", CHECK_ON),
                                   ("!selected", CHECK_OFF)],
              indicatorforeground=[("selected", BG_DARK),
                                   ("!selected", CHECK_OFF)])

    # ── Radiobutton ───────────────────────────────────────────────────
    style.configure("TRadiobutton", background=BG_DARK, foreground=FG_MAIN,
                    indicatorbackground=CHECK_OFF, font=("Segoe UI", 9))
    style.map("TRadiobutton",
              background=[("active", BG_DARK)],
              indicatorbackground=[("selected", CHECK_ON),
                                   ("!selected", CHECK_OFF)])

    style.configure("Panel.TRadiobutton", background=BG_PANEL)
    style.map("Panel.TRadiobutton",
              background=[("active", BG_PANEL)],
              indicatorbackground=[("selected", CHECK_ON),
                                   ("!selected", CHECK_OFF)])

    # ── Treeview ──────────────────────────────────────────────────────
    style.configure("Treeview", background=BG_TREE, foreground=FG_MAIN,
                    fieldbackground=BG_TREE, borderwidth=0,
                    rowheight=24, font=("Cascadia Code", 9))
    style.map("Treeview",
              background=[("selected", SELECT_BG)],
              foreground=[("selected", FG_BRIGHT)])

    style.configure("Treeview.Heading", background=BG_INPUT,
                    foreground=FG_DIM, font=("Segoe UI", 9))

    # ── Progressbar ───────────────────────────────────────────────────
    style.configure("TProgressbar", background=PROGRESS_FG,
                    troughcolor=PROGRESS_BG, borderwidth=0, thickness=8)

    # ── Separator ─────────────────────────────────────────────────────
    style.configure("TSeparator", background=BORDER)

    # ── PanedWindow ───────────────────────────────────────────────────
    style.configure("TPanedwindow", background=BG_DARK)

    # ── Scrollbar ─────────────────────────────────────────────────────
    style.configure("Vertical.TScrollbar", background=BG_PANEL,
                    troughcolor=BG_DARK, arrowcolor=FG_DIM, borderwidth=0)
    style.map("Vertical.TScrollbar",
              background=[("active", ACCENT), ("pressed", ACCENT_HOVER)])


class VermilionApp(tk.Tk):
    """Main application window."""

    def __init__(self):
        super().__init__()

        self.title("Vermilion")
        self.geometry("1200x820")
        self.minsize(960, 640)
        self.configure(bg=BG_DARK)

        # Apply our polished dark theme
        apply_dark_theme(self)

        # Current plan (set after Preview)
        self._current_plan = None
        self._current_images = []
        self._current_non_images = []
        self._last_undo_log = None  # path to last undo log

        self._build_layout()
        self._connect_signals()
        self._bind_shortcuts()

    # ------------------------------------------------------------------
    # Layout
    # ------------------------------------------------------------------

    def _build_layout(self):
        """Create the two-pane layout with all panels."""

        # ── Title bar area ────────────────────────────────────────────
        title_frame = ttk.Frame(self)
        title_frame.pack(fill="x", padx=16, pady=(12, 4))

        ttk.Label(
            title_frame, text="Vermilion",
            style="Heading.TLabel",
            font=("Segoe UI Semibold", 16),
        ).pack(side="left")

        ttk.Label(
            title_frame,
            text="Organise, distribute & rename your files",
            style="Dim.TLabel",
        ).pack(side="left", padx=(12, 0), pady=(4, 0))

        # Undo button (right side of title)
        self.undo_btn = ttk.Button(
            title_frame, text="↩ Undo Last", style="Cancel.TButton",
            command=self._on_undo, state="disabled",
        )
        self.undo_btn.pack(side="right", padx=(8, 0))

        # ── Preset bar ────────────────────────────────────────────────
        preset_frame = ttk.Frame(self)
        preset_frame.pack(fill="x", padx=16, pady=(0, 2))

        ttk.Label(preset_frame, text="Preset:", style="Dim.TLabel").pack(
            side="left",
        )
        self.preset_var = tk.StringVar()
        self.preset_combo = ttk.Combobox(
            preset_frame, textvariable=self.preset_var, width=20,
            values=list_presets(), state="readonly",
        )
        self.preset_combo.pack(side="left", padx=(6, 6))

        ttk.Button(
            preset_frame, text="Load", width=6,
            command=self._on_load_preset,
        ).pack(side="left", padx=(0, 4))

        ttk.Button(
            preset_frame, text="Save", width=6,
            command=self._on_save_preset,
        ).pack(side="left", padx=(0, 12))

        ttk.Label(
            preset_frame,
            text="Ctrl+P Preview  |  Ctrl+E Execute  |  Ctrl+Z Undo",
            style="Dim.TLabel", font=("Segoe UI", 8),
        ).pack(side="right")

        # ── Thin separator ────────────────────────────────────────────
        ttk.Separator(self, orient="horizontal").pack(
            fill="x", padx=16, pady=(4, 8),
        )

        # ── Main paned window: left settings | right preview ──────────
        paned = ttk.PanedWindow(self, orient="horizontal")
        paned.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        # -- Left column: scrollable settings --------------------------
        left_outer = ttk.Frame(paned)
        paned.add(left_outer, weight=2)

        # Canvas + scrollbar for scrolling the left column
        self._left_canvas = tk.Canvas(
            left_outer, highlightthickness=0, bg=BG_DARK, bd=0,
        )
        left_scroll = ttk.Scrollbar(
            left_outer, orient="vertical",
            command=self._left_canvas.yview,
        )
        self._left_canvas.configure(yscrollcommand=left_scroll.set)
        left_scroll.pack(side="right", fill="y")
        self._left_canvas.pack(side="left", fill="both", expand=True)

        self._left_frame = ttk.Frame(self._left_canvas)
        self._left_canvas_window = self._left_canvas.create_window(
            (0, 0), window=self._left_frame, anchor="nw",
        )

        self._left_frame.bind("<Configure>", self._on_left_frame_configure)
        self._left_canvas.bind("<Configure>", self._on_left_canvas_configure)

        # Mousewheel scrolling
        self._left_canvas.bind_all("<MouseWheel>", self._on_mousewheel)

        # Panels
        self.source_panel = SourcePanel(self._left_frame)
        self.source_panel.pack(fill="x", pady=(0, 10), padx=4)

        self.options_panel = OptionsPanel(self._left_frame)
        self.options_panel.pack(fill="x", pady=(0, 10), padx=4)

        self.rules_panel = RulesPanel(self._left_frame)
        self.rules_panel.pack(fill="x", pady=(0, 10), padx=4)

        # -- Right column: preview -------------------------------------
        self.preview_panel = PreviewPanel(paned)
        paned.add(self.preview_panel, weight=3)

    # ------------------------------------------------------------------
    # Signal wiring
    # ------------------------------------------------------------------

    def _connect_signals(self):
        self.preview_panel.preview_btn.configure(command=self._on_preview)
        self.preview_panel.execute_btn.configure(command=self._on_execute)
        self.preview_panel.cancel_btn.configure(command=self.destroy)

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------

    def _on_preview(self):
        """Scan the source directory and generate a preview plan."""
        src = self.source_panel.get_source()
        if not src or not os.path.isdir(src):
            messagebox.showerror("Error", "Please select a valid source directory.")
            return

        dest = self.source_panel.get_dest()
        if not dest:
            messagebox.showerror("Error", "Please select a destination directory.")
            return

        self.preview_panel.set_status("Scanning…")
        self.update_idletasks()

        # Scan source (new files)
        recursive = self.source_panel.get_recursive()
        images, non_images = scan_directory(src, recursive=recursive)

        # -- Merge mode: also scan the destination for existing files -------
        merge = self.source_panel.get_merge()
        if merge and dest and os.path.isdir(dest) and dest != src:
            self.preview_panel.set_status("Scanning destination for merge…")
            self.update_idletasks()
            dest_images, dest_non_images = scan_directory(
                dest, recursive=True,
            )
            images = images + dest_images
            non_images = non_images + dest_non_images

            # De-duplicate by absolute path (in case source overlaps dest)
            seen = set()
            unique_images = []
            for fi in images:
                ap = os.path.abspath(fi.path)
                if ap not in seen:
                    seen.add(ap)
                    unique_images.append(fi)
            images = unique_images

            seen_ni = set()
            unique_non = []
            for fi in non_images:
                ap = os.path.abspath(fi.path)
                if ap not in seen_ni:
                    seen_ni.add(ap)
                    unique_non.append(fi)
            non_images = unique_non

        if not images and not non_images:
            messagebox.showinfo("Info", "No files found.")
            self.preview_panel.set_status("No files found.")
            return

        self._current_images = images
        self._current_non_images = non_images

        # Build rename func if enabled
        rename_func = None
        if self.rules_panel.is_rename_enabled():
            components = self.rules_panel.get_rename_components()
            separator = self.rules_panel.get_separator()
            if components:
                rename_func = build_rename_func(components, separator)

                # Update rename preview with first file
                if images:
                    example = rename_func(images[0], 1)
                    self.rules_panel.update_preview(example)

        # Collect filters
        filters = self.rules_panel.get_filters()

        # Build config
        config = PlanConfig(
            source_dir=src,
            dest_dir=dest,
            sort_by=self.options_panel.get_sort_by(),
            char_count=self.options_panel.get_char_count(),
            distribution_mode=self.options_panel.get_distribution_mode(),
            distribution_count=self.options_panel.get_count(),
            structure=self.options_panel.get_structure(),
            append_range=self.options_panel.get_append_range(),
            recursive=recursive,
            rename_func=rename_func,
            filters=filters,
        )

        # Plan
        plan = generate_plan(images, non_images, config)
        self._current_plan = plan

        # Display
        self.preview_panel.display_plan(plan)

        filtered_str = ""
        if plan.total_filtered > 0:
            filtered_str = f"  |  Filtered: {plan.total_filtered}"

        merge_str = ""
        if merge:
            merge_str = "  (MERGE)"

        self.preview_panel.set_status(
            f"Preview ready{merge_str}  —  {plan.total_images} images  →  "
            f"{plan.total_folders} folders  |  "
            f"{plan.total_non_images} non-image"
            f"{filtered_str}"
        )

    def _on_execute(self):
        """Execute the current plan."""
        if self._current_plan is None:
            messagebox.showwarning("Warning", "Please generate a preview first.")
            return

        plan = self._current_plan
        mode = self.source_panel.get_operation()
        conflict = self.source_panel.get_conflict()

        verb = "move" if mode == "move" else "copy"
        count = plan.total_images + plan.total_non_images
        confirm = messagebox.askyesno(
            "Confirm",
            f"This will {verb} {count} file(s) into "
            f"{plan.total_folders} folder(s).\n\n"
            f"Destination: {plan.root_path}\n"
            f"Conflict handling: {conflict}\n\n"
            "Proceed?",
        )
        if not confirm:
            return

        # Disable buttons during execution
        self.preview_panel.preview_btn.configure(state="disabled")
        self.preview_panel.execute_btn.configure(state="disabled")

        def _progress(current, total, filename):
            self.after(0, lambda: self.preview_panel.set_progress(
                current, total, filename,
            ))

        def _run():
            stats = execute_plan(
                plan, mode=mode, conflict=conflict,
                progress_callback=_progress,
            )
            self.after(0, lambda: self._on_execute_done(stats))

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()

    def _on_execute_done(self, stats: dict):
        """Called on the main thread when execution finishes."""
        self.preview_panel.preview_btn.configure(state="normal")
        self.preview_panel.execute_btn.configure(state="normal")

        errors = stats.get("errors", [])
        copied = stats.get("copied", 0)
        moved = stats.get("moved", 0)
        skipped = stats.get("skipped", 0)

        msg = (
            f"Done!\n\n"
            f"Copied: {copied}\n"
            f"Moved: {moved}\n"
            f"Skipped: {skipped}\n"
            f"Errors: {len(errors)}"
        )

        undo_path = stats.get("undo_log_path")
        if undo_path:
            msg += f"\n\nUndo log saved to:\n{undo_path}"
            self._last_undo_log = undo_path
            self.undo_btn.configure(state="normal")

        if errors:
            error_detail = "\n".join(
                f"  • {path}: {err}" for path, err in errors[:10]
            )
            if len(errors) > 10:
                error_detail += f"\n  … and {len(errors) - 10} more"
            msg += f"\n\nError details:\n{error_detail}"
            messagebox.showwarning("Complete with Errors", msg)
        else:
            messagebox.showinfo("Complete", msg)

        self.preview_panel.set_status("Execution complete.")
        self.preview_panel.progress_var.set(100)
        self._current_plan = None

        # Remember paths for recent directories
        self.source_panel.remember_paths()

    # ------------------------------------------------------------------
    # Scroll helpers
    # ------------------------------------------------------------------

    def _on_left_frame_configure(self, event):
        self._left_canvas.configure(
            scrollregion=self._left_canvas.bbox("all"),
        )

    def _on_left_canvas_configure(self, event):
        self._left_canvas.itemconfigure(
            self._left_canvas_window, width=event.width,
        )

    def _on_mousewheel(self, event):
        try:
            cx = self._left_canvas.winfo_rootx()
            cy = self._left_canvas.winfo_rooty()
            cw = self._left_canvas.winfo_width()
            ch = self._left_canvas.winfo_height()
            if (cx <= event.x_root <= cx + cw and
                    cy <= event.y_root <= cy + ch):
                self._left_canvas.yview_scroll(
                    int(-1 * (event.delta / 120)), "units",
                )
        except tk.TclError:
            pass

    # ------------------------------------------------------------------
    # Undo
    # ------------------------------------------------------------------

    def _on_undo(self):
        if not self._last_undo_log or not os.path.isfile(self._last_undo_log):
            messagebox.showinfo("Undo", "No undo log available.")
            return

        confirm = messagebox.askyesno(
            "Undo",
            f"Reverse the last operation?\n\n"
            f"Log: {self._last_undo_log}\n\n"
            f"Moved files will be returned to their original location.\n"
            f"Copied files will be deleted.",
        )
        if not confirm:
            return

        self.preview_panel.set_status("Undoing…")
        self.undo_btn.configure(state="disabled")

        def _run():
            result = undo_last(self._last_undo_log)
            self.after(0, lambda: self._on_undo_done(result))

        threading.Thread(target=_run, daemon=True).start()

    def _on_undo_done(self, result: dict):
        rev = result.get("reversed", 0)
        deleted = result.get("deleted", 0)
        errs = result.get("errors", [])
        msg = (
            f"Undo complete!\n\n"
            f"Reversed (moved back): {rev}\n"
            f"Deleted (copies removed): {deleted}\n"
            f"Errors: {len(errs)}"
        )
        if errs:
            msg += "\n\n" + "\n".join(f"  • {e}" for _, e in errs[:5])
        messagebox.showinfo("Undo", msg)
        self.preview_panel.set_status("Undo complete.")
        self._last_undo_log = None

    # ------------------------------------------------------------------
    # Presets
    # ------------------------------------------------------------------

    def _collect_settings(self) -> dict:
        """Gather current UI settings into a serialisable dict."""
        return {
            "sort_by": self.options_panel.sort_var.get(),
            "distribution_mode": self.options_panel.mode_var.get(),
            "distribution_count": self.options_panel.count_var.get(),
            "structure": self.options_panel.structure_var.get(),
            "append_range": self.options_panel.append_range_var.get(),
            "reorganize": self.options_panel.reorganize_var.get(),
            "operation": self.source_panel.operation_var.get(),
            "conflict": self.source_panel.conflict_var.get(),
            "recursive": self.source_panel.recursive_var.get(),
            "merge": self.source_panel.merge_var.get(),
            "rename_enabled": self.rules_panel.rename_enabled_var.get(),
            "separator": self.rules_panel.separator_var.get(),
        }

    def _apply_settings(self, data: dict):
        """Apply a settings dict to the UI."""
        if "sort_by" in data:
            self.options_panel.sort_var.set(data["sort_by"])
        if "distribution_mode" in data:
            self.options_panel.mode_var.set(data["distribution_mode"])
        if "distribution_count" in data:
            self.options_panel.count_var.set(data["distribution_count"])
        if "structure" in data:
            self.options_panel.structure_var.set(data["structure"])
        if "append_range" in data:
            self.options_panel.append_range_var.set(data["append_range"])
        if "reorganize" in data:
            self.options_panel.reorganize_var.set(data["reorganize"])
        if "operation" in data:
            self.source_panel.operation_var.set(data["operation"])
        if "conflict" in data:
            self.source_panel.conflict_var.set(data["conflict"])
        if "recursive" in data:
            self.source_panel.recursive_var.set(data["recursive"])
        if "merge" in data:
            self.source_panel.merge_var.set(data["merge"])
        if "rename_enabled" in data:
            self.rules_panel.rename_enabled_var.set(data["rename_enabled"])
        if "separator" in data:
            self.rules_panel.separator_var.set(data["separator"])

    def _on_save_preset(self):
        from tkinter import simpledialog
        name = simpledialog.askstring(
            "Save Preset", "Preset name:", parent=self,
        )
        if not name or not name.strip():
            return
        data = self._collect_settings()
        save_preset(name.strip(), data)
        self.preset_combo.configure(values=list_presets())
        self.preset_var.set(name.strip())
        messagebox.showinfo("Preset", f"Saved preset '{name.strip()}'.")

    def _on_load_preset(self):
        name = self.preset_var.get()
        if not name:
            messagebox.showinfo("Preset", "Select a preset first.")
            return
        data = load_preset(name)
        if not data:
            messagebox.showwarning("Preset", f"Preset '{name}' not found.")
            return
        self._apply_settings(data)
        self.preview_panel.set_status(f"Loaded preset: {name}")

    # ------------------------------------------------------------------
    # Keyboard shortcuts
    # ------------------------------------------------------------------

    def _bind_shortcuts(self):
        self.bind_all("<Control-p>", lambda e: self._on_preview())
        self.bind_all("<Control-e>", lambda e: self._on_execute())
        self.bind_all("<Control-z>", lambda e: self._on_undo())

