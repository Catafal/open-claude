/**
 * Authentication IPC Handlers
 *
 * Handles login, logout, and auth status checking.
 * Uses Claude.ai cookie-based authentication.
 */

import { BrowserWindow, ipcMain, session } from 'electron';
import { isAuthenticated, getOrgId, store, BASE_URL } from '../../api/client.js';
import { AUTH } from '../channels.js';

/**
 * Registers all authentication-related IPC handlers.
 */
export function registerAuthHandlers(): void {
  // Check if user is authenticated
  ipcMain.handle(AUTH.GET_STATUS, async () => {
    return isAuthenticated();
  });

  // Open login window and authenticate via cookies
  ipcMain.handle(AUTH.LOGIN, async () => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      title: 'Sign in to Claude',
    });

    authWindow.loadURL(`${BASE_URL}/login`);

    // Check for successful authentication cookies
    const checkCookies = async (): Promise<{ success: boolean; error?: string } | null> => {
      const cookies = await session.defaultSession.cookies.get({ domain: '.claude.ai' });
      const sessionKey = cookies.find(c => c.name === 'sessionKey')?.value;
      const orgId = cookies.find(c => c.name === 'lastActiveOrg')?.value;

      if (sessionKey && orgId) {
        console.log('[Auth] Got cookies from webview!');
        authWindow.close();
        store.set('orgId', orgId);
        return { success: true };
      }
      return null;
    };

    return new Promise((resolve) => {
      authWindow.webContents.on('did-finish-load', async () => {
        const result = await checkCookies();
        if (result) resolve(result);
      });

      // Poll for cookies in case the navigation doesn't trigger did-finish-load
      const interval = setInterval(async () => {
        if (authWindow.isDestroyed()) {
          clearInterval(interval);
          return;
        }
        const result = await checkCookies();
        if (result) {
          clearInterval(interval);
          resolve(result);
        }
      }, 1000);

      authWindow.on('closed', () => {
        clearInterval(interval);
        resolve({ success: false, error: 'Window closed' });
      });
    });
  });

  // Logout - clear Claude.ai session, preserve user settings
  ipcMain.handle(AUTH.LOGOUT, async () => {
    store.delete('orgId');
    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    return { success: true };
  });
}
