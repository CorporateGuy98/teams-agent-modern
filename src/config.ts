import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  // Azure Bot
  microsoftAppId: process.env.MicrosoftAppId || "",
  microsoftAppPassword: process.env.MicrosoftAppPassword || "",
  microsoftAppType: process.env.MicrosoftAppType || "MultiTenant",

  // Server
  port: parseInt(process.env.PORT || "3978", 10),

  // Ollama
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.1:8b",

  // ManageEngine ServiceDesk Plus
  manageEngineEndpoint:
    process.env.MANAGE_ENGINE_ENDPOINT ||
    "https://servicedesk.klimasan.com.tr/api/v3/requests",
  manageEngineAuthToken: process.env.MANAGE_ENGINE_AUTHTOKEN || "",

  // Limits
  maxMessageLength: 1000,
  rateLimitSeconds: 60,
  ollamaTimeoutMs: 30_000,
  gracefulShutdownMs: 10_000,
};
