<div align="center">
  <img src="./git-banner.jpg" alt="Scallions Banner" width="800" />
</div>

# Scallions

Scallions is a seasonal calendar web app displaying what's currently in season across California produce and professional sports.

## Features

- **Live In-Season Produce & Sports**: Displays California fruits and vegetables along with major sports seasons, Grand Slams, and sumo basho currently in season or coming soon.
- **Dynamic Typography**: Assigns curated Google Fonts to each item on load, with "Jefferson Williams" rendered in *Young Serif*.
- **Interactive Details**: Clicking any item reveals its full seasonal dates in a clean popup modal.
- **Credit Modal**: Includes a year-round signature entry linking to the [JeffersonWM Project Hub](https://github.com/users/wmjefferson/projects/4).

## Local Development

From this directory:

```powershell
npm install
npm run dev
```

Or run the local backend server with live MySQL sync:

```powershell
npm run server
```

From the monorepo root:

```powershell
npm run dev:scall
npm run build:scall
npm run publish:scall
```
