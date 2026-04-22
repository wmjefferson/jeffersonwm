# Release Checklist

Use this checklist whenever you deploy one or more apps from the monorepo.

## Before You Build

- [ ] Pull the latest `main`
- [ ] Confirm the app(s) you are releasing
- [ ] Review recent commits for anything not ready to ship
- [ ] Confirm required env files are present locally

## Local Verification

- [ ] Run `npm run build` from the monorepo root
- [ ] If releasing only one app, also run its app-specific build command
- [ ] Open the built output if needed for a quick visual check
- [ ] Confirm the `dist` output is fresh

## Upload

- [ ] Upload the contents of the app `dist` folder, not the `dist` folder itself
- [ ] Replace `index.html` in the matching ASO app folder
- [ ] Replace the `assets` contents in the matching ASO app folder
- [ ] For Perihelion, confirm the home-server API/tunnel is running if backend behavior is part of the release

## Post-Deploy Checks

- [ ] Hard refresh the live app
- [ ] Verify the correct hosted path loads
- [ ] Test the app's main user flow
- [ ] Check browser console/network for errors
- [ ] If applicable, verify API-backed features in production

## Wrap-Up

- [ ] Add release notes to your log or issue tracker
- [ ] Note any follow-up bugs or polish items
- [ ] Confirm GitHub is up to date with the released commit
