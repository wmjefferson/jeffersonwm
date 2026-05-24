"""
Batch renamer — Adobe Bridge-style rename component system.

Components are assembled in user-specified order with a separator to
produce new filenames.
"""

import datetime
import os
from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Rename components
# ---------------------------------------------------------------------------

@dataclass
class RenameComponent:
    """One piece of a rename template."""
    kind: str           # 'original', 'text', 'sequence', 'date'
    enabled: bool = True
    # -- kind-specific settings --
    text: str = ""                  # for 'text'
    seq_start: int = 1              # for 'sequence'
    seq_digits: int = 3             # for 'sequence' (0 = no padding)
    date_format: str = "%Y%m%d"    # for 'date'


# ---------------------------------------------------------------------------
# Rename engine
# ---------------------------------------------------------------------------

class Renamer:
    """
    Builds a callable that maps (FileInfo, sequence_number) → new filename.
    """

    def __init__(
        self,
        components: list[RenameComponent],
        separator: str = "_",
    ):
        self.components = [c for c in components if c.enabled]
        self.separator = separator

    def generate_name(self, file_info, sequence_num: int) -> str:
        """
        Produce a new filename (with extension) for *file_info*.
        *sequence_num* is the 1-based index within the batch.
        """
        parts: list[str] = []
        for comp in self.components:
            part = self._eval_component(comp, file_info, sequence_num)
            if part:
                parts.append(part)

        if not parts:
            # Fallback: keep original name
            return file_info.name

        base = self.separator.join(parts)
        return base + file_info.extension

    # -- Internal -----------------------------------------------------------

    def _eval_component(self, comp: RenameComponent, fi, seq: int) -> str:
        if comp.kind == "original":
            return fi.name_no_ext
        elif comp.kind == "text":
            return comp.text
        elif comp.kind == "sequence":
            num = comp.seq_start + seq - 1
            if comp.seq_digits > 0:
                return str(num).zfill(comp.seq_digits)
            else:
                return str(num)
        elif comp.kind == "date":
            dt = datetime.datetime.fromtimestamp(fi.date_modified)
            return dt.strftime(comp.date_format)
        return ""


def build_rename_func(components: list[RenameComponent], separator: str = "_"):
    """
    Return a callable (file_info, seq_num) -> new_name suitable for
    passing into PlanConfig.rename_func.
    """
    renamer = Renamer(components, separator)
    return renamer.generate_name
