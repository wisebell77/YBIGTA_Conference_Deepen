import { google } from "googleapis";
import type { Credentials, OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";
import {
  OAUTH_SCOPES,
  SESSION_COOKIE_NAME
} from "./constants";
import {
  createGoogleAuthStore,
  type AuthStatus,
  type GoogleAuthStore,
  type GoogleUserProfile
} from "./auth-store";

export function getOAuthClient(): OAuth2Client {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      "Missing Google OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
    );
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function getGoogleAuthUrl(state?: string): string {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: OAUTH_SCOPES,
    state
  });
}

export async function exchangeCodeForGoogleSession(
  code: string,
  authStore: GoogleAuthStore = createGoogleAuthStore()
): Promise<{ user: GoogleUserProfile; sessionId: string; expiresAt: Date }> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  const user = await getGoogleUserProfile(oauth2Client, tokens);

  if (!tokens.refresh_token) {
    const existing = await authStore.readTokensForUser(user.id);
    if (!existing?.refresh_token) {
      throw new Error("GOOGLE_REFRESH_TOKEN_MISSING");
    }
    const merged = { ...existing, ...tokens };
    await authStore.upsertUserTokens(user, merged);
  } else {
    await authStore.upsertUserTokens(user, tokens);
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const session = await authStore.createSession(user.id, expiresAt);
  return { user, sessionId: session.id, expiresAt };
}

export async function getAuthorizedOAuthClient(
  authStore: GoogleAuthStore = createGoogleAuthStore()
): Promise<OAuth2Client> {
  const userId = await getCurrentGoogleUserId(authStore);
  const tokens = await authStore.readTokensForUser(userId);
  if (!tokens?.refresh_token) {
    throw new Error("GOOGLE_DRIVE_NOT_CONNECTED");
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

export async function getGoogleAuthStatus(
  authStore: GoogleAuthStore = createGoogleAuthStore()
): Promise<AuthStatus> {
  const sessionId = await getSessionCookieValue();
  if (!sessionId) return { connected: false, user: null };

  const session = await authStore.readSession(sessionId);
  if (!session) return { connected: false, user: null };

  const user = await authStore.readUser(session.userId);
  if (!user) return { connected: false, user: null };

  return { connected: true, user, expiresAt: session.expiresAt };
}

export async function getCurrentGoogleUserId(
  authStore: GoogleAuthStore = createGoogleAuthStore()
): Promise<string> {
  const sessionId = await getSessionCookieValue();
  if (!sessionId) throw new Error("GOOGLE_DRIVE_NOT_CONNECTED");

  const session = await authStore.readSession(sessionId);
  if (!session) throw new Error("GOOGLE_DRIVE_NOT_CONNECTED");

  return session.userId;
}

export async function deleteCurrentGoogleSession(
  authStore: GoogleAuthStore = createGoogleAuthStore()
): Promise<void> {
  const sessionId = await getSessionCookieValue();
  if (sessionId) await authStore.deleteSession(sessionId);
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  };
}

async function getSessionCookieValue(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

async function getGoogleUserProfile(
  oauth2Client: OAuth2Client,
  tokens: Credentials
): Promise<GoogleUserProfile> {
  if (tokens.id_token) {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (payload?.sub && payload.email) {
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      };
    }
  }

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const response = await oauth2.userinfo.get();
  if (!response.data.id || !response.data.email) {
    throw new Error("GOOGLE_PROFILE_MISSING");
  }

  return {
    id: response.data.id,
    email: response.data.email,
    name: response.data.name,
    picture: response.data.picture
  };
}
