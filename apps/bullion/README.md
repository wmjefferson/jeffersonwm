# Bullion

![Bullion - Batch Rename](https://jeffersonwm.com/pic/gitprofbullion.jpg)

Bullion is a batch rename utility for sorting files, previewing new names, and exporting the processed set as a ZIP. It is designed to feel direct and practical, with a small number of strong features instead of a sprawling interface.

## Local Development

From the monorepo root:

```powershell
npm run install:bullion
npm run build:bullion
```

For app development inside the app folder:

```powershell
cd apps/bullion
npm run dev
```

If Bullion uses Gemini-backed features, copy `.env.example` to `.env.local` and set:

```text
GEMINI_API_KEY=your_key_here
```

## Deployment

Hosted path:

- `https://jeffersonwm.com/bullion/`

Build output:

- `apps/bullion/dist`

Hosted destination:

- `/home2/jeffers4/jeffersonwm.com/bullion/`
