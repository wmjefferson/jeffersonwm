"""
Rename Panel — Adobe Bridge-style batch rename configuration.
Components can be enabled/disabled and reordered with Up/Down buttons.
Styled for dark theme.
"""

import tkinter as tk
from tkinter import ttk

from core.renamer import RenameComponent


# Separator options
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


class RenamePanel(ttk.LabelFrame):
    """Adobe Bridge-style batch rename configuration."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, text="  Batch Rename  ", padding=(14, 10), **kwargs)

        self.enabled_var = tk.BooleanVar(value=False)
        self._component_widgets: list[dict] = []

        self._build_ui()
        self._toggle_enabled()

    def _build_ui(self):
        # -- Enable toggle --------------------------------------------------
        ttk.Checkbutton(
            self, text="Enable batch rename",
            variable=self.enabled_var, command=self._toggle_enabled,
            style="Panel.TCheckbutton",
        ).grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 10))

        # -- Components frame -----------------------------------------------
        self.comp_frame = ttk.Frame(self)
        self.comp_frame.grid(row=1, column=0, columnspan=3, sticky="ew")

        # Build component rows
        self._add_component_row("original", "Original filename", 0)
        self._add_component_row("text", "Custom text", 1)
        self._add_component_row("sequence", "Sequence number", 2)
        self._add_component_row("date", "Date", 3)

        # -- Reorder buttons (next to components) ---------------------------
        reorder_frame = ttk.Frame(self)
        reorder_frame.grid(row=1, column=2, sticky="ns", padx=(8, 0))

        ttk.Button(reorder_frame, text="▲", width=3,
                   command=self._move_up).pack(pady=(0, 4))
        ttk.Button(reorder_frame, text="▼", width=3,
                   command=self._move_down).pack()

        # -- Sequence settings ----------------------------------------------
        seq_frame = ttk.Frame(self)
        seq_frame.grid(row=2, column=0, columnspan=3, sticky="ew", pady=(10, 0))

        ttk.Label(seq_frame, text="Start #:", style="Panel.TLabel").pack(
            side="left",
        )
        self.seq_start_var = tk.IntVar(value=1)
        ttk.Spinbox(seq_frame, textvariable=self.seq_start_var,
                     from_=0, to=999999, width=7).pack(side="left", padx=(6, 16))

        ttk.Label(seq_frame, text="Digits:", style="Panel.TLabel").pack(
            side="left",
        )
        self.seq_digits_var = tk.IntVar(value=3)
        ttk.Spinbox(seq_frame, textvariable=self.seq_digits_var,
                     from_=0, to=8, width=4).pack(side="left", padx=(6, 12))

        ttk.Label(
            seq_frame, text="(0 = no padding)", style="Dim.TLabel",
        ).pack(side="left")

        # -- Custom text entry + date format --------------------------------
        text_frame = ttk.Frame(self)
        text_frame.grid(row=3, column=0, columnspan=3, sticky="ew", pady=(8, 0))

        ttk.Label(text_frame, text="Text:", style="Panel.TLabel").pack(
            side="left",
        )
        self.custom_text_var = tk.StringVar(value="")
        ttk.Entry(text_frame, textvariable=self.custom_text_var,
                  width=18).pack(side="left", padx=(6, 16))

        ttk.Label(text_frame, text="Date format:", style="Panel.TLabel").pack(
            side="left",
        )
        self.date_format_var = tk.StringVar(value="YYYYMMDD")
        ttk.Combobox(text_frame, textvariable=self.date_format_var,
                     values=list(DATE_FORMATS.keys()), state="readonly",
                     width=13).pack(side="left", padx=(6, 0))

        # -- Separator + preview --------------------------------------------
        sep_frame = ttk.Frame(self)
        sep_frame.grid(row=4, column=0, columnspan=3, sticky="ew", pady=(10, 0))

        ttk.Label(sep_frame, text="Separator:", style="Panel.TLabel").pack(
            side="left",
        )
        self.separator_var = tk.StringVar(value="Underscore (_)")
        ttk.Combobox(sep_frame, textvariable=self.separator_var,
                     values=list(SEPARATORS.keys()), state="readonly",
                     width=16).pack(side="left", padx=(6, 20))

        ttk.Label(sep_frame, text="Preview:", style="Panel.TLabel").pack(
            side="left",
        )
        self.preview_label = ttk.Label(
            sep_frame, text="—", style="Dim.TLabel",
            font=("Cascadia Code", 9),
        )
        self.preview_label.pack(side="left", padx=(6, 0))

        self.columnconfigure(0, weight=1)

    def _add_component_row(self, kind: str, label: str, row_idx: int):
        """Add one component row with a checkbox and radio for selection."""
        var = tk.BooleanVar(value=(kind == "original"))

        if not hasattr(self, '_selected_idx'):
            self._selected_idx = tk.IntVar(value=0)

        cb = ttk.Checkbutton(
            self.comp_frame, text=label, variable=var,
            style="Panel.TCheckbutton",
        )
        cb.grid(row=row_idx, column=0, sticky="w", pady=2)

        sel = ttk.Radiobutton(
            self.comp_frame, text="", variable=self._selected_idx,
            value=row_idx, style="Panel.TRadiobutton",
        )
        sel.grid(row=row_idx, column=1, padx=(8, 0))

        widget_info = {
            "kind": kind,
            "label": label,
            "enabled_var": var,
            "checkbox": cb,
            "radio": sel,
            "row": row_idx,
        }
        self._component_widgets.append(widget_info)

    def _toggle_enabled(self):
        state = "normal" if self.enabled_var.get() else "disabled"
        for child in self.comp_frame.winfo_children():
            try:
                child.configure(state=state)
            except tk.TclError:
                pass
        for row_idx in range(2, 6):
            for child in self.grid_slaves(row=row_idx):
                for sub in child.winfo_children():
                    try:
                        sub.configure(state=state)
                    except tk.TclError:
                        pass

    def _move_up(self):
        idx = self._selected_idx.get()
        if idx > 0:
            self._swap_components(idx, idx - 1)
            self._selected_idx.set(idx - 1)

    def _move_down(self):
        idx = self._selected_idx.get()
        if idx < len(self._component_widgets) - 1:
            self._swap_components(idx, idx + 1)
            self._selected_idx.set(idx + 1)

    def _swap_components(self, i: int, j: int):
        """Swap two component rows visually and in the data list."""
        self._component_widgets[i], self._component_widgets[j] = \
            self._component_widgets[j], self._component_widgets[i]

        for new_row, w in enumerate(self._component_widgets):
            w["checkbox"].grid(row=new_row, column=0, sticky="w", pady=2)
            w["radio"].grid(row=new_row, column=1, padx=(8, 0))
            w["radio"].configure(value=new_row)
            w["row"] = new_row

    # -- Public getters -----------------------------------------------------

    def is_enabled(self) -> bool:
        return self.enabled_var.get()

    def get_separator(self) -> str:
        return SEPARATORS.get(self.separator_var.get(), "_")

    def get_components(self) -> list[RenameComponent]:
        """Return components in current order."""
        comps = []
        for w in self._component_widgets:
            comp = RenameComponent(kind=w["kind"], enabled=w["enabled_var"].get())
            if w["kind"] == "text":
                comp.text = self.custom_text_var.get()
            elif w["kind"] == "sequence":
                comp.seq_start = self.seq_start_var.get()
                comp.seq_digits = self.seq_digits_var.get()
            elif w["kind"] == "date":
                fmt_label = self.date_format_var.get()
                comp.date_format = DATE_FORMATS.get(fmt_label, "%Y%m%d")
            comps.append(comp)
        return comps

    def update_preview(self, example_name: str):
        """Update the preview label with an example rename."""
        self.preview_label.configure(text=example_name)
