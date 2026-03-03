import fetch from "node-fetch";
import { config } from "../config";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Gets a bot framework bearer token for downloading inline images.
 * In Emulator mode (no AppId), returns null — no auth needed.
 * Token is cached until it expires.
 */
export async function getBotToken(): Promise<string | null> {
  // Emulator mode — no token needed
  if (!config.microsoftAppId || !config.microsoftAppPassword) {
    return null;
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const tokenUrl =
    "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.microsoftAppId,
    client_secret: config.microsoftAppPassword,
    scope: "https://api.botframework.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    console.error(
      `[TOKEN] Failed to get bot token: ${response.status} ${response.statusText}`
    );
    return null;
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  console.log("[TOKEN] Bot token acquired/refreshed.");
  return cachedToken;
}
