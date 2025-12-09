/**
 * GitHub Release Update Checker
 * Checks for new releases on GitHub and notifies the user.
 * No code signing required - user manually downloads new .dmg.
 */

import { app, dialog, shell } from 'electron';

// GitHub repository info
const GITHUB_OWNER = 'catafal';
const GITHUB_REPO = 'open-claude';

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  name: string;
  body: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  releaseNotes: string;
  dmgDownloadUrl: string | null;
}

/**
 * Compare two semver version strings.
 * Returns true if latestVersion > currentVersion.
 */
function isNewerVersion(currentVersion: string, latestVersion: string): boolean {
  // Remove 'v' prefix if present
  const current = currentVersion.replace(/^v/, '').split('.').map(Number);
  const latest = latestVersion.replace(/^v/, '').split('.').map(Number);

  // Compare major.minor.patch
  for (let i = 0; i < Math.max(current.length, latest.length); i++) {
    const c = current[i] || 0;
    const l = latest[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Fetch the latest release from GitHub.
 * Returns null if request fails or no releases exist.
 */
async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'open-claude-updater'
      }
    });

    if (!response.ok) {
      // 404 means no releases yet - not an error
      if (response.status === 404) {
        console.log('[Updater] No releases found on GitHub');
        return null;
      }
      console.error(`[Updater] GitHub API error: ${response.status}`);
      return null;
    }

    return await response.json() as GitHubRelease;
  } catch (error) {
    console.error('[Updater] Failed to fetch release:', error);
    return null;
  }
}

/**
 * Check for updates and return info if a newer version is available.
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const currentVersion = app.getVersion();
  console.log(`[Updater] Current version: ${currentVersion}`);

  const release = await fetchLatestRelease();
  if (!release) {
    return null;
  }

  const latestVersion = release.tag_name;
  console.log(`[Updater] Latest release: ${latestVersion}`);

  if (!isNewerVersion(currentVersion, latestVersion)) {
    console.log('[Updater] App is up to date');
    return null;
  }

  // Find .dmg asset if available
  const dmgAsset = release.assets.find(a => a.name.endsWith('.dmg'));

  console.log(`[Updater] Update available: ${currentVersion} → ${latestVersion}`);

  return {
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
    releaseName: release.name || latestVersion,
    releaseNotes: release.body || '',
    dmgDownloadUrl: dmgAsset?.browser_download_url || null
  };
}

/**
 * Check for updates and show a dialog if one is available.
 * Call this on app startup.
 */
export async function checkForUpdatesAndNotify(): Promise<void> {
  try {
    const updateInfo = await checkForUpdates();

    if (!updateInfo) {
      return; // No update available
    }

    // Show update dialog
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version of Open Claude is available!`,
      detail: `Current: v${updateInfo.currentVersion}\nLatest: ${updateInfo.latestVersion}\n\n${updateInfo.releaseNotes.slice(0, 200)}${updateInfo.releaseNotes.length > 200 ? '...' : ''}`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      // Open release page (or direct .dmg download if available)
      const url = updateInfo.dmgDownloadUrl || updateInfo.releaseUrl;
      await shell.openExternal(url);
    }
  } catch (error) {
    // Non-blocking: log error but don't crash
    console.error('[Updater] Error checking for updates:', error);
  }
}
