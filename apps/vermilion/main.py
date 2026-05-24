r"""
Vermilion — Entry Point

Launch with:
    python main.py                     # opens empty
    python main.py "C:\path\to\folder" # opens with source pre-filled
"""

import os
import sys

# Ensure project root is on sys.path
_PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from app import VermilionApp


def main():
    app = VermilionApp()

    # Accept a folder path as an argument (e.g. from Explorer context menu)
    if len(sys.argv) > 1:
        folder = sys.argv[1]
        if os.path.isdir(folder):
            app.source_panel.source_var.set(folder)

    app.mainloop()


if __name__ == "__main__":
    main()
