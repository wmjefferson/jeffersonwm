"""
Options Panel — sorting method, distribution mode, folder structure,
range appending, and reorganise-existing toggle.
Styled for dark theme.
"""

import tkinter as tk
from tkinter import ttk


# Maps displayed label → internal sort_by value + char_count
SORT_OPTIONS = {
    "First 1 character":   ("char", 1),
    "First 2 characters":  ("char", 2),
    "First 3 characters":  ("char", 3),
    "Full filename":       ("full", 0),
    "Date modified":       ("date_modified", 0),
    "Date created":        ("date_created", 0),
}

DISTRIBUTION_MODES = {
    "Exact count per folder":  "exact_per_folder",
    "Max files per folder":    "max_per_folder",
    "Number of folders":       "num_folders",
}

STRUCTURE_STYLES = {
    "Flat  (SD-01, SD-02)":         "flat",
    "Nested  (SD / 01, SD / 02)":   "nested",
}


class OptionsPanel(ttk.LabelFrame):
    """Sorting, distribution, structure options."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, text="  Sorting & Distribution  ", padding=(14, 10), **kwargs)
        self._build_ui()

    def _build_ui(self):
        row = 0

        # -- Sort by -------------------------------------------------------
        ttk.Label(self, text="Sort by:", style="Panel.TLabel").grid(
            row=row, column=0, sticky="w", padx=(0, 8), pady=5,
        )
        self.sort_var = tk.StringVar(value="First 2 characters")
        sort_combo = ttk.Combobox(
            self, textvariable=self.sort_var, width=24,
            values=list(SORT_OPTIONS.keys()), state="readonly",
        )
        sort_combo.grid(row=row, column=1, sticky="w", pady=5)

        # -- Distribution mode ---------------------------------------------
        row += 1
        ttk.Label(self, text="Mode:", style="Panel.TLabel").grid(
            row=row, column=0, sticky="w", padx=(0, 8), pady=5,
        )
        self.mode_var = tk.StringVar(value="Exact count per folder")
        mode_combo = ttk.Combobox(
            self, textvariable=self.mode_var, width=24,
            values=list(DISTRIBUTION_MODES.keys()), state="readonly",
        )
        mode_combo.grid(row=row, column=1, sticky="w", pady=5)

        # -- Count -----------------------------------------------------------
        row += 1
        ttk.Label(self, text="Count:", style="Panel.TLabel").grid(
            row=row, column=0, sticky="w", padx=(0, 8), pady=5,
        )
        self.count_var = tk.IntVar(value=50)
        count_spin = ttk.Spinbox(
            self, textvariable=self.count_var, from_=1, to=99999, width=10,
        )
        count_spin.grid(row=row, column=1, sticky="w", pady=5)

        # -- Folder structure -----------------------------------------------
        row += 1
        ttk.Label(self, text="Structure:", style="Panel.TLabel").grid(
            row=row, column=0, sticky="w", padx=(0, 8), pady=5,
        )
        self.structure_var = tk.StringVar(value="Flat  (SD-01, SD-02)")
        struct_combo = ttk.Combobox(
            self, textvariable=self.structure_var, width=28,
            values=list(STRUCTURE_STYLES.keys()), state="readonly",
        )
        struct_combo.grid(row=row, column=1, sticky="w", pady=5)

        # -- Append range ---------------------------------------------------
        row += 1
        self.append_range_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            self, text="Append sort range to folder names  (e.g.  - Sa - Sp)",
            variable=self.append_range_var, style="Panel.TCheckbutton",
        ).grid(row=row, column=0, columnspan=2, sticky="w", pady=(6, 3))

        # -- Reorganise existing --------------------------------------------
        row += 1
        self.reorganize_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            self, text="Reorganise existing (flatten & redistribute)",
            variable=self.reorganize_var, style="Panel.TCheckbutton",
        ).grid(row=row, column=0, columnspan=2, sticky="w", pady=(3, 0))

        # Expand
        self.columnconfigure(1, weight=1)

    # -- Public getters -----------------------------------------------------

    def get_sort_by(self) -> str:
        label = self.sort_var.get()
        return SORT_OPTIONS[label][0]

    def get_char_count(self) -> int:
        label = self.sort_var.get()
        return SORT_OPTIONS[label][1]

    def get_distribution_mode(self) -> str:
        label = self.mode_var.get()
        return DISTRIBUTION_MODES[label]

    def get_count(self) -> int:
        return self.count_var.get()

    def get_structure(self) -> str:
        label = self.structure_var.get()
        return STRUCTURE_STYLES[label]

    def get_append_range(self) -> bool:
        return self.append_range_var.get()

    def get_reorganize(self) -> bool:
        return self.reorganize_var.get()
