# Perihelion Home-Server Sync

Use this when mirroring the repo-side Perihelion file-handling work onto the live Python API behind:

- `https://api.jeffersonwm.com`

## Repo changes already completed

- frontend supports `Include Other Files`
- frontend supports `Show Folder Thumbnails`
- local Node dev backend emits richer `folders` data:
  - `thumbnailPath`
  - `thumbnailKind`
  - `thumbnailExt`
  - `itemCount`

## Live Python API shape to match

The live `/api/images` response should keep its current keys and add these fields on each folder object:

```json
{
  "name": "merged",
  "path": "merged",
  "modified": 1777148016,
  "type": "directory",
  "thumbnailPath": "merged/example.jpg",
  "thumbnailKind": "image",
  "thumbnailExt": ".jpg",
  "itemCount": 12
}
```

## Thumbnail selection rule

For each folder:

1. list visible files in that folder
2. sort them naturally/alphabetically
3. choose the first visible file as the preview source
4. expose its relative path as `thumbnailPath`
5. derive:
   - `thumbnailKind`: `image`, `video`, or `other`
   - `thumbnailExt`: file extension
6. expose file count as `itemCount`

If the folder is empty:

```json
{
  "thumbnailPath": null,
  "thumbnailKind": null,
  "thumbnailExt": "",
  "itemCount": 0
}
```

## Pillow

Install Pillow in the Python environment used by the live script:

```powershell
pip install -r apps/perihelion/backend/requirements.txt
```

or:

```powershell
pip install Pillow
```

Pillow is intended for metadata access and future preview/inspection work even if the initial folder-thumbnail pass only needs filename ordering.

## After patching the live script

1. restart the Perihelion API process on port `8010`
2. ensure the `api-perihelion` tunnel is running
3. test:

```powershell
try { (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8010/api/images?page=1&limit=5&path=").Content } catch { $_ | Out-String }
```

Then:

```powershell
try { (Invoke-WebRequest -UseBasicParsing "https://api.jeffersonwm.com/api/images?page=1&limit=5&path=").Content } catch { $_ | Out-String }
```

Once the folder objects include thumbnail fields, the live frontend will begin rendering folder previews automatically.
