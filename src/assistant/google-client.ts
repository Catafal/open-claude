/**
 * Google OAuth2 Client
 *
 * Handles OAuth2 authentication flow and token management for Google services.
 * Supports multiple Google accounts with automatic token refresh.
 */

import { google } from 'googleapis';
import { BrowserWindow } from 'electron';
import Store from 'electron-store';
import type { GoogleAccount, AssistantSettingsStore, OAuthResult } from './types';
import type { StoreSchema } from '../types';

// OAuth2 scopes - readonly access + gmail send for automation
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',  // For morning email automation
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/userinfo.email'  // To get email address
];

// Redirect URI for Electron desktop app (localhost)
const REDIRECT_URI = 'http://localhost:8085/oauth2callback';

// Store instance for persistent settings
const store = new Store<StoreSchema>() as Store<StoreSchema> & {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K];
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void;
};

// =============================================================================
// Settings Management
// =============================================================================

/**
 * Get assistant settings from store.
 * Returns defaults if not configured.
 */
export function getAssistantSettings(): AssistantSettingsStore {
  return store.get('assistantSettings') || {
    enabled: false,
    googleAccounts: []
  };
}

/**
 * Save assistant settings to store.
 */
export function saveAssistantSettings(settings: AssistantSettingsStore): void {
  store.set('assistantSettings', settings);
  console.log('[Assistant] Settings saved');
}

/**
 * Get enabled Google accounts.
 */
export function getEnabledAccounts(): GoogleAccount[] {
  const settings = getAssistantSettings();
  return settings.googleAccounts.filter(a => a.enabled);
}

// =============================================================================
// OAuth2 Client Creation
// =============================================================================

/**
 * Create OAuth2 client with credentials.
 * Uses stored client ID/secret or environment variables.
 */
function createOAuth2Client(): InstanceType<typeof google.auth.OAuth2> {
  const settings = getAssistantSettings();

  // Get credentials from settings or environment
  const clientId = settings.googleClientId || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = settings.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth2 credentials not configured');
  }

  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

/**
 * Create authenticated OAuth2 client for a specific account.
 * Handles automatic token refresh.
 */
export async function getAuthenticatedClient(
  account: GoogleAccount
): Promise<InstanceType<typeof google.auth.OAuth2>> {
  const oauth2Client = createOAuth2Client();

  // Set current tokens
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt
  });

  // Check if token needs refresh (5 min buffer)
  const now = Date.now();
  if (account.expiresAt && account.expiresAt - now < 5 * 60 * 1000) {
    console.log(`[Assistant] Refreshing token for ${account.email}`);
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update stored account with new tokens
      const settings = getAssistantSettings();
      const accountIndex = settings.googleAccounts.findIndex(a => a.email === account.email);
      if (accountIndex >= 0) {
        settings.googleAccounts[accountIndex] = {
          ...account,
          accessToken: credentials.access_token || account.accessToken,
          expiresAt: credentials.expiry_date || account.expiresAt
        };
        saveAssistantSettings(settings);
      }

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error(`[Assistant] Token refresh failed for ${account.email}:`, error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return oauth2Client;
}

// =============================================================================
// OAuth2 Flow (Add Account)
// =============================================================================

/**
 * Start OAuth2 flow to add a new Google account.
 * Opens browser window for user authentication.
 *
 * @returns Promise with OAuth result (success + account or error)
 */
export async function startOAuthFlow(): Promise<OAuthResult> {
  return new Promise((resolve) => {
    let oauth2Client: InstanceType<typeof google.auth.OAuth2>;

    try {
      oauth2Client = createOAuth2Client();
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'OAuth2 client creation failed'
      });
      return;
    }

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',        // Get refresh token
      prompt: 'consent',             // Force consent to get refresh token
      scope: SCOPES
    });

    // Create browser window for OAuth
    const authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      title: 'Sign in with Google'
    });

    let resolved = false;

    // Handle redirect with auth code
    authWindow.webContents.on('will-redirect', async (_event, url) => {
      if (resolved) return;

      if (url.startsWith(REDIRECT_URI)) {
        resolved = true;
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error');

        if (error) {
          authWindow.close();
          resolve({ success: false, error: `OAuth error: ${error}` });
          return;
        }

        if (!code) {
          authWindow.close();
          resolve({ success: false, error: 'No authorization code received' });
          return;
        }

        try {
          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);

          // Get user email
          const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
          const userInfo = await oauth2.userinfo.get();
          const email = userInfo.data.email;

          if (!email) {
            authWindow.close();
            resolve({ success: false, error: 'Could not retrieve email address' });
            return;
          }

          // Check if account already exists
          const settings = getAssistantSettings();
          const existingIndex = settings.googleAccounts.findIndex(a => a.email === email);

          const newAccount: GoogleAccount = {
            email,
            accessToken: tokens.access_token || '',
            refreshToken: tokens.refresh_token || '',
            expiresAt: tokens.expiry_date || Date.now() + 3600 * 1000,
            enabled: true
          };

          if (existingIndex >= 0) {
            // Update existing account
            settings.googleAccounts[existingIndex] = newAccount;
            console.log(`[Assistant] Updated existing account: ${email}`);
          } else {
            // Add new account
            settings.googleAccounts.push(newAccount);
            console.log(`[Assistant] Added new account: ${email}`);
          }

          saveAssistantSettings(settings);
          authWindow.close();
          resolve({ success: true, account: newAccount });
        } catch (error) {
          authWindow.close();
          resolve({
            success: false,
            error: `Token exchange failed: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
    });

    // Handle window close
    authWindow.on('closed', () => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'Authentication cancelled' });
      }
    });

    // Load auth URL
    authWindow.loadURL(authUrl);
  });
}

// =============================================================================
// Account Management
// =============================================================================

/**
 * Remove a Google account.
 */
export function removeGoogleAccount(email: string): boolean {
  const settings = getAssistantSettings();
  const initialLength = settings.googleAccounts.length;
  settings.googleAccounts = settings.googleAccounts.filter(a => a.email !== email);

  if (settings.googleAccounts.length < initialLength) {
    saveAssistantSettings(settings);
    console.log(`[Assistant] Removed account: ${email}`);
    return true;
  }

  return false;
}

/**
 * Toggle account enabled state.
 */
export function toggleAccountEnabled(email: string, enabled: boolean): boolean {
  const settings = getAssistantSettings();
  const account = settings.googleAccounts.find(a => a.email === email);

  if (account) {
    account.enabled = enabled;
    saveAssistantSettings(settings);
    console.log(`[Assistant] Account ${email} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  return false;
}

/**
 * Test connection for an account by making a simple API call.
 */
export async function testAccountConnection(email: string): Promise<{ success: boolean; error?: string }> {
  const settings = getAssistantSettings();
  const account = settings.googleAccounts.find(a => a.email === email);

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  try {
    const auth = await getAuthenticatedClient(account);
    const calendar = google.calendar({ version: 'v3', auth });

    // Simple test: list calendars
    await calendar.calendarList.list({ maxResults: 1 });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if assistant is enabled and has at least one account.
 */
export function isAssistantReady(): boolean {
  const settings = getAssistantSettings();
  return settings.enabled && settings.googleAccounts.some(a => a.enabled);
}

/**
 * Check if an account has valid tokens (has refresh token for re-auth).
 * Returns false if account needs reconnection (no tokens or missing refresh token).
 */
export function hasValidTokens(email: string): boolean {
  const settings = getAssistantSettings();
  const account = settings.googleAccounts.find(a => a.email === email);

  if (!account) return false;

  // Account needs reconnect if missing refresh token (can't auto-refresh)
  return Boolean(account.refreshToken && account.accessToken);
}

/**
 * Validate all accounts and return their token status.
 * Used by UI to show which accounts need reconnection.
 */
export function getAccountsTokenStatus(): { email: string; hasValidTokens: boolean }[] {
  const settings = getAssistantSettings();
  return settings.googleAccounts.map(account => ({
    email: account.email,
    hasValidTokens: Boolean(account.refreshToken && account.accessToken)
  }));
}
