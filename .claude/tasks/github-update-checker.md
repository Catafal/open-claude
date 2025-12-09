# GitHub Release Update Checker

## Status: COMPLETED ✓

## Overview
Implement a manual update checker that queries GitHub Releases API on app startup to notify the user when a new version is available.

## Workflow
1. User pushes code to GitHub
2. User builds `.dmg` locally (`pnpm dist`)
3. User creates GitHub Release with version tag (e.g., `v1.0.1`) and attaches `.dmg`
4. App checks GitHub Releases on startup
5. If newer version found → show dialog with "Download" button → opens GitHub release page

## Implementation Tasks

### 1. Create Update Checker Module ✓
- **File**: `src/updater.ts`
- Query GitHub API: `https://api.github.com/repos/catafal/open-claude/releases/latest`
- Compare versions using semver logic
- Return update info or null if current version is latest

### 2. Integrate into Main Process ✓
- **File**: `src/main.ts`
- Call `checkForUpdatesAndNotify()` on `app.whenReady()`
- Show native dialog if update available
- "Download" button opens release URL in browser (or direct .dmg download if asset exists)

### 3. Configuration ✓
- GitHub repo: `catafal/open-claude`
- Current version from `app.getVersion()`
- Repository field added to `package.json`

## Changes Made

### `src/updater.ts` (NEW)
- `checkForUpdates()` - Fetches latest release, compares versions
- `checkForUpdatesAndNotify()` - Shows dialog if update available
- `isNewerVersion()` - Semver comparison helper
- Non-blocking error handling

### `src/main.ts`
- Added import for `checkForUpdatesAndNotify`
- Call on app startup in `app.whenReady()`

### `package.json`
- Added `repository` field with GitHub URL

## How to Create a Release
1. Bump version in `package.json` (e.g., `1.0.0` → `1.0.1`)
2. Build: `pnpm dist`
3. Go to GitHub → Releases → "Create new release"
4. Tag: `v1.0.1` (must match package.json with 'v' prefix)
5. Attach `.dmg` from `release/` folder
6. Publish

## Notes
- No code signing required
- Non-blocking: errors are logged, don't crash app
- User manually downloads and replaces `.app`
- Data persists in `~/Library/Application Support/open-claude/`
