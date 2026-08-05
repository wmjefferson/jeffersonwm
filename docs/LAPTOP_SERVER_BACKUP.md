# JeffersonWM Laptop-To-Server Backup

## Purpose

This setup copies the local Dotcoms site folders from the laptop to the server backup folder.

The laptop remains the source of truth. The server folder is a backup copy of the whole Dotcoms tree.

Source root:

```text
C:\Users\wmjef\Desktop\Precious Box\Dotcoms
```

Destination root:

```text
\\JEFFERSHIZZLE-D\Dotcoms E\backuplaptop
```

## Files Added

Backup script:

```text
C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\scripts\backup-laptop-to-server.ps1
```

VSCode tasks:

```text
C:\Users\wmjef\Desktop\Precious Box\Dotcoms\jeffersonwm\.vscode\tasks.json
```

Backup logs:

```text
\\JEFFERSHIZZLE-D\Dotcoms E\backuplaptop\_backup-logs
```

## VSCode Tasks

The project has these VSCode tasks:

```text
backup laptop: preview
backup laptop: copy
backup laptop: mirror
```

For normal use, use only:

```text
backup laptop: preview
backup laptop: copy
```

The mirror task exists as an emergency/exact-sync option, but it is not recommended for normal backups.

## Recommended Workflow

1. Run `backup laptop: preview`.
2. Look for anything surprising.
3. If the preview looks good, run `backup laptop: copy`.

The preview is safe. It does not copy, overwrite, or delete anything.

The script copies each top-level folder under `Dotcoms` into a matching folder under the backup root, so the site folders stay grouped by name on the server.

## Manual Commands

Run preview:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-laptop-to-server.ps1 -Mode Preview
```

Run safe copy:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-laptop-to-server.ps1 -Mode Copy
```

Run mirror:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-laptop-to-server.ps1 -Mode Mirror
```

## What Preview Does

`backup laptop: preview` uses `robocopy /L`.

The `/L` flag means list only.

Preview shows what would happen if the real copy ran, but it does not actually copy, overwrite, or delete anything.

## Common Preview Messages

`New File`

This file exists on the laptop but not in the server backup. A real copy would add it.

`New Dir`

This folder exists on the laptop but not in the server backup. A real copy would create it.

`Newer`

The laptop file is newer than the server backup. A real copy would update the backup copy.

`Older`

The laptop file is older than the server backup. Usually this means the destination has a newer version. This is worth checking if unexpected.

`Same`

The file exists in both places and appears unchanged. Nothing would happen.

`Extra File`

This file exists in the server backup but not on the laptop.

With normal `copy`, it stays there.

With `mirror`, it would be deleted.

`Extra Dir`

This folder exists in the server backup but not on the laptop.

With normal `copy`, it stays there.

With `mirror`, it would be deleted.

`FAILED`

Robocopy could not access something. Possible causes include permissions, locked files, network issues, or path length problems.

If `FAILED` is anything other than `0`, stop and investigate before trusting the backup.

## Summary Columns

At the end of the preview or copy, robocopy shows a summary like this:

```text
Dirs : Total Copied Skipped Mismatch FAILED Extras
Files: Total Copied Skipped Mismatch FAILED Extras
```

`Total`

Everything robocopy looked at.

`Copied`

Files or folders that would be copied or updated.

`Skipped`

Files or folders already matching, or intentionally excluded.

`Mismatch`

Something exists in both places but differs in a way robocopy considers unusual.

`FAILED`

Items that could not be processed. This should normally be `0`.

`Extras`

Items that exist only in the destination backup folder.

With normal `copy`, extras stay in place.

With `mirror`, extras can be deleted.

## Normal Copy Behavior

The normal copy task does not delete files from the server backup.

It copies new files and updates changed files from the laptop to the server.

This is the safest routine backup option.

## Mirror Behavior

Mirror makes the destination match the source exactly.

That means if a file exists on the server backup but not on the laptop, mirror can delete it.

Because of that, mirror should only be used intentionally and after previewing.

For normal use, avoid mirror.

## Excluded Folders And Files

The backup skips common rebuildable or noisy folders and files:

```text
node_modules
.vite
.cache
.turbo
.next
*.log
```

This keeps the backup smaller and avoids copying dependency/cache clutter.

## First Backup Result

The first safe copy completed successfully on July 30, 2026.

Summary:

```text
Files copied: 2,281
Bytes copied: 436.73 MB
Failures: 0
```

The backup included source files, `.git`, built `dist` folders, and build outputs. It skipped dependency/cache/log clutter listed above.

## Personal Rule

Use preview first.

If preview looks normal, use copy.

Do not use mirror unless there is a specific reason.
