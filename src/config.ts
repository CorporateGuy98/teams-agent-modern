import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  // Azure Bot
  microsoftAppId: process.env.MicrosoftAppId || "",
  microsoftAppPassword: process.env.MicrosoftAppPassword || "",
  microsoftAppType: process.env.MicrosoftAppType || "MultiTenant",

  // Server
  port: parseInt(process.env.PORT || "3978", 10),

  // Gemini API
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiBaseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",

  // ManageEngine ServiceDesk Plus
  manageEngineEndpoint:
    process.env.MANAGE_ENGINE_ENDPOINT ||
    "https://servicedesk.klimasan.com.tr/api/v3/requests",
  manageEngineAuthToken: process.env.MANAGE_ENGINE_AUTHTOKEN || "",

  // Limits
  maxMessageLength: 1000,
  rateLimitSeconds: 60,
  geminiTimeoutMs: 15_000,
  gracefulShutdownMs: 10_000,
};
