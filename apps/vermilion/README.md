# Vermilion — User Guide

A desktop application for sorting, distributing, and batch-renaming large directories of files (primarily images). Built with Python and tkinter. No external dependencies required.

---

## Table of Contents

1. [Requirements](#requirements)
2. [Installation](#installation)
3. [Launching the App](#launching-the-app)
4. [Windows Explorer Integration](#windows-explorer-integration)
5. [Interface Overview](#interface-overview)
6. [Source & Destination Panel](#source--destination-panel)
7. [Sorting & Distribution Panel](#sorting--distribution-panel)
8. [Rules & Filters Panel](#rules--filters-panel)
9. [Preview Panel](#preview-panel)
10. [Presets](#presets)
11. [Undo](#undo)
12. [Keyboard Shortcuts](#keyboard-shortcuts)
13. [Typical Workflows](#typical-workflows)
14. [Supported File Types](#supported-file-types)
15. [Project Structure](#project-structure)
16. [Troubleshooting](#troubleshooting)

---

## Requirements

- **Python 3.10 or newer** (uses `match` syntax, type hints with `|`)
- **tkinter** (included with standard Python installations on Windows)
- No `pip install` required — the entire application runs on the Python standard library

To verify your Python installation:
```
python --version
```

---

## Installation

1. Copy or clone the `vermilion/` directory to any location on your machine
2. That's it — no build step, no virtual environment needed

---

## Launching the App

### From the command line
```bash
cd path\to\vermilion
python main.py
```

### With a source folder pre-filled
```bash
python main.py "C:\Users\Bill\Pictures\Unsorted"
```
This opens the app with the source directory already set — useful for scripts and shortcuts.

### From a desktop shortcut
1. Right-click your Desktop → **New** → **Shortcut**
2. Enter: `python "C:\full\path\to\vermilion\main.py"`
3. Name it "Vermilion"
4. Optionally change the icon via **Properties** → **Change Icon**

---

## Windows Explorer Integration

You can add a right-click context menu entry so that right-clicking any folder in Explorer shows **"Organize with Vermilion"**.

### To install
1. Right-click `install_context_menu.bat` → **Run as Administrator**
2. Accept the UAC prompt
3. You'll see a confirmation message

### To use
- Right-click any folder → **Organize with Vermilion**
- The app opens with that folder set as the source

### To uninstall
- Right-click `uninstall_context_menu.bat` → **Run as Administrator**

---

## Interface Overview

The app has a **two-pane layout**:

```
┌──────────────────────────────────────────────────────────────┐
│  Vermilion               Preset: [dropdown] [Load] [Save]   │
├───────────────────────────┬──────────────────────────────────┤
│  Source & Destination     │                                  │
│  ├ Source path            │         Preview Tree             │
│  ├ Destination path       │         📁 Destination           │
│  ├ Options (copy/move)    │           📁 01 - AB - CD (30)  │
│                           │             📄 file1.jpg        │
│  Sorting & Distribution   │             📄 file2.jpg        │
│  ├ Sort by                │           📁 02 - DE - FG (30)  │
│  ├ Mode                   │           ...                    │
│  ├ Count                  │                                  │
│                           │  ⚠ Duplicate warnings            │
│  Rules & Filters          │  Summary stats                   │
│  ├ Rename components      │  Progress bar                    │
│  ├ Filter blocks          │  [Preview] [Execute] [Export]    │
│  ├ [+ Add Rule]           │                                  │
└───────────────────────────┴──────────────────────────────────┘
```

**Left side**: Scrollable settings panels (scroll with mousewheel)
**Right side**: Live preview tree, progress, and action buttons

---

## Source & Destination Panel

### Source Directory
The folder containing the files you want to organise. Set it by:
- Clicking **Browse…** to open a folder picker
- Clicking **📋** to paste a path from your clipboard
- Typing or selecting from the **recent directories** dropdown

Once set, a **live file count** appears below: `📊 120 images | 15 other`

### Destination Directory
Where the organised output will be created. Set the same way as source.

### Options

| Option | Description |
|--------|-------------|
| **Output in place** | Writes the organised structure back into the source directory. Disables the destination field. |
| **Merge into destination** | Scans the destination for existing files, combines them with the source files, and redistributes everything together. Use this to add new files to an already-organised folder. |
| **Operation: Copy / Move** | Copy keeps the originals intact. Move relocates them (faster, no duplicates). |
| **Conflicts: skip / overwrite / auto_rename** | What to do when a file already exists at the destination. `auto_rename` appends `_01`, `_02`, etc. |
| **Include subfolders** | When checked, scans the source recursively. When unchecked, only processes the top level. |

---

## Sorting & Distribution Panel

### Sort by

Controls the order files are arranged in before distribution:

| Option | How it sorts | Example grouping |
|--------|-------------|-----------------|
| **First 1 character** | By the first letter of the filename | `A/`, `B/`, `S/` |
| **First 2 characters** | By the first two letters | `AB/`, `SD/`, `ZZ/` |
| **First 3 characters** | By the first three letters | `ABC/`, `SDG/` |
| **Full filename** | Alphabetically by entire name | No grouping — even distribution |
| **Date modified** | By file modification timestamp | `2024-01-15/`, `2024-03-22/` |
| **Date created** | By file creation timestamp | Same as above |

### Distribution Mode

| Mode | Description |
|------|-------------|
| **Exact count per folder** | Puts exactly N files in each folder sequentially, regardless of character grouping. The last folder gets the remainder. **Recommended for most use cases.** |
| **Max files per folder** | Groups files by their sort key (e.g., first 2 chars), then splits groups that exceed the count into subfolders (`SD-01`, `SD-02`). |
| **Number of folders** | Distributes files evenly across exactly N folders. |

### Count
The number for the chosen mode — e.g., `30` means 30 files per folder.

### Structure

| Style | Result |
|-------|--------|
| **Flat** | `SD-01/`, `SD-02/` (hyphenated, all at root level) |
| **Nested** | `SD/01/`, `SD/02/` (parent folder with numbered children) |

### Append sort range
When checked, folder names include the first and last file prefix:
- `01 - Ab - Cz (30)` instead of just `01 (30)`

### Reorganise existing
Flattens an already-organised directory structure before redistributing. Useful for re-sorting with different criteria.

---

## Rules & Filters Panel

This panel uses a **dynamic block system**. You add rule blocks from the dropdown, and each block can be individually enabled, disabled, removed, or reordered.

### Adding a rule
1. Select a rule type from the dropdown at the bottom
2. Click **+ Add Rule**
3. Configure the block's settings
4. Use **▲ ▼** to reorder, **✕** to remove

### Rename Blocks

Enable batch rename with the **"Enable batch rename"** checkbox at the top. The rename preview shows an example of the output filename.

| Block | Description | Example output |
|-------|-------------|---------------|
| **Original Filename** | Keeps the original filename (without extension) | `vacation_photo` |
| **Custom Text** | Inserts fixed text you specify | `Photo` |
| **Sequence Number** | Adds a sequential number with configurable start and zero-padding | `001`, `002`, `003` |
| **Date** | Inserts the file's date in a chosen format | `20240315` |

**Separator** (top-right): Choose the character between rename components — underscore, hyphen, space, dot, or none.

**Example**: Custom Text `Photo` + Sequence (start=1, digits=4) + Original Filename with underscore separator produces:
```
Photo_0001_vacation_beach.jpg
```

### Filter Blocks

Filters are applied **before** distribution. Matching files are either ignored entirely or moved to a named category folder.

#### Filter: File Extensions
- Select categories to match: **Web Images** (.jpg .png .gif .webp .svg .avif), **RAW Photos** (.cr2 .nef .arw .dng .raw), **Design Files** (.psd .exr), **Apple Formats** (.heic .heif), **Legacy/Other** (.bmp .tiff .ico)
- **Action: Ignore** — matching files are excluded from the output
- **Action: Move to folder** — matching files go to a named folder (e.g., `RAW_PHOTOS/`)

#### Filter: File Size
- **Above / Below / Between** a specified size
- Set min/max values and unit (Bytes, KB, MB, GB)
- Example: Ignore files above 50 MB, or move files below 100 KB to `THUMBNAILS/`

#### Filter: Date Range
- **Before / After / Between** specified dates (YYYY-MM-DD format)
- Choose the date field: **modified** or **created**
- Example: Move files created before 2020-01-01 to `OLD_PHOTOS/`

---

## Preview Panel

### Preview Tree
Click **🔍 Preview** (or `Ctrl+P`) to generate the planned folder structure without touching any files. The tree shows:
- 📁 Folder names with file counts
- 📄 Individual files (capped at 25 per folder, shows "and N more")
- Rename mappings: `original.jpg → Photo_001.jpg`
- Filter folders and non-image folders

### Duplicate Detection
If any files would end up with the same filename in the output, a **yellow warning** appears:
```
⚠ 3 duplicate filename(s) detected (6 files total) — conflicts may occur
```

### Export
Click **📄 Export** to save the plan as a **.txt** (readable tree) or **.csv** (spreadsheet-ready with columns: Folder, Original Name, New Name, Source Path, Destination).

### Execute
Click **▶ Execute** (or `Ctrl+E`) to carry out the plan. You'll see:
- A confirmation dialog with the operation summary
- A progress bar during execution
- A completion dialog with copied/moved/skipped/error counts
- The undo log path (saved automatically)

---

## Presets

Save and load named configurations to avoid re-setting options every time.

### Save a preset
1. Configure all your settings
2. Click **Save** in the preset bar (top of window)
3. Enter a name (e.g., "30 per folder alphabetical")
4. Settings are saved as a JSON file in the `presets/` directory

### Load a preset
1. Select a preset from the dropdown
2. Click **Load**
3. All settings are restored (source/destination paths are not included)

### What's saved in a preset
Sort mode, distribution mode/count, structure, append range, reorganise toggle, operation (copy/move), conflict handling, recursive, merge, rename enabled, and separator.

---

## Undo

Every execution writes an undo log file (`_undo_log_YYYYMMDD_HHMMSS.json`) to the destination directory.

### To undo the last operation
1. Click **↩ Undo Last** in the title bar (or `Ctrl+Z`)
2. Confirm the reversal
3. For **moved** files: files are moved back to their original location
4. For **copied** files: the copies are deleted

The undo button is only enabled after a successful execution within the current session.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Generate preview |
| `Ctrl+E` | Execute plan |
| `Ctrl+Z` | Undo last operation |

---

## Typical Workflows

### Organise a folder of unsorted images into groups of 30
1. Source: your unsorted folder
2. Sort by: **First 2 characters**
3. Mode: **Exact count per folder**, Count: **30**
4. Check **Append sort range**
5. Preview → Execute

### Add 50 new images to an already-organised folder
1. Source: folder with 50 new images
2. Destination: your already-organised folder
3. Check **Merge into destination**
4. Keep the same sort/distribution settings as the original
5. Preview → Execute (everything gets redistributed together)

### Separate RAW files from web images
1. Add a **Filter: File Extensions** rule
2. Check **RAW Photos** (.cr2 .nef .arw .dng .raw)
3. Action: **Move to folder**: `RAW`
4. Preview → RAW files appear in their own `RAW/` folder

### Batch rename with sequence numbers
1. Enable batch rename
2. Add **Custom Text**: `Photo`
3. Add **Sequence Number**: start 1, digits 4
4. Separator: Underscore
5. Result: `Photo_0001.jpg`, `Photo_0002.jpg`, …

### Ignore large video files mixed in with images
1. Add a **Filter: File Size** rule
2. Mode: **Above**, Min: `100`, Unit: **MB**
3. Action: **Ignore**
4. Large files are excluded from the output entirely

---

## Supported File Types

The following extensions are recognised as **images** and included in the distribution:

| Category | Extensions |
|----------|-----------|
| Web | `.jpg` `.jpeg` `.png` `.gif` `.webp` `.svg` `.avif` |
| RAW | `.raw` `.cr2` `.nef` `.arw` `.dng` |
| Design | `.psd` `.exr` |
| Apple | `.heic` `.heif` |
| Legacy | `.bmp` `.tiff` `.tif` `.ico` |

All other file types are automatically placed in a `_NON_IMAGE/` folder and excluded from the distribution count.

---

## Project Structure

```
vermilion/
├── main.py                         # Entry point (accepts folder argument)
├── app.py                          # Main window, theme, panel wiring
├── utils.py                        # Constants, sort helpers, sanitisation
├── core/
│   ├── scanner.py                  # Directory walker, file classification
│   ├── planner.py                  # Distribution algorithm (the brain)
│   ├── renamer.py                  # Component-based batch rename engine
│   ├── executor.py                 # File move/copy + undo log
│   ├── presets.py                  # Save/load named configurations
│   └── recents.py                  # Recent directory tracking
├── panels/
│   ├── source_panel.py             # Source/dest pickers, options
│   ├── options_panel.py            # Sort, distribution, structure
│   ├── rules_panel.py              # Dynamic rename + filter blocks
│   └── preview_panel.py            # Tree view, export, duplicates
├── presets/                        # Saved preset JSON files
├── install_context_menu.bat        # Add Explorer right-click entry
├── uninstall_context_menu.bat      # Remove Explorer right-click entry
└── README.md                       # This file
```

---

## Troubleshooting

### "python is not recognized"
Python is not on your system PATH. Either:
- Reinstall Python and check **"Add to PATH"** during setup
- Use the full path: `C:\Python312\python.exe main.py`

### Checkboxes don't appear to toggle
Make sure you're running Python 3.10+ with tkinter's `clam` theme support. The dark theme uses custom indicator colours — on older Python versions the indicators may not render correctly.

### Context menu doesn't appear after install
- Make sure you ran `install_context_menu.bat` as **Administrator**
- Try restarting Explorer (Task Manager → Restart "Windows Explorer")

### Large directories are slow to preview
The preview tree caps file display at 25 per folder. For very large directories (100K+ files), the scanning and planning phase may take a few seconds. The UI stays responsive during execution (background thread).

### Undo button is greyed out
The undo button only activates after an execution within the current session. If you closed and reopened the app, you can still manually undo by running the tool on the same directory — the `_undo_log_*.json` file remains in the destination folder.
