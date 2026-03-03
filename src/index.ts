import restify from "restify";
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
} from "botbuilder";
import { config } from "./config";
import { validateEnv } from "./utils/envValidator";
import { createApp } from "./app";

// --- Validate environment before anything else ---
validateEnv();

// --- Create adapter ---
const botAuth = new ConfigurationBotFrameworkAuthentication({
  MicrosoftAppId: config.microsoftAppId,
  MicrosoftAppPassword: config.microsoftAppPassword,
  MicrosoftAppType: config.microsoftAppType,
});

const adapter = new CloudAdapter(botAuth);

// --- Error handler ---
adapter.onTurnError = async (context, error) => {
  console.error("[ADAPTER] Unhandled error:", error);
  try {
    await context.sendActivity(
      "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin."
    );
  } catch {
    // Swallow — channel might not be reachable
  }
};

// --- Create Teams AI Application ---
const app = createApp();

// --- Restify server ---
const server = restify.createServer({ name: "helpdesk-bot" });
server.use(restify.plugins.bodyParser());

server.post("/api/messages", async (req, res) => {
  await adapter.process(req, res, async (context) => {
    await app.run(context);
  });
});

server.get("/health", (_req, res) => {
  res.send(200, { status: "ok", timestamp: new Date().toISOString() });
});

server.listen(config.port, () => {
  console.log(`[SERVER] Bot running at http://localhost:${config.port}/api/messages`);
});

// --- Graceful shutdown ---
function shutdown(signal: string) {
  console.log(`[SERVER] ${signal} received, shutting down...`);

  const forceExit = setTimeout(() => {
    console.error("[SERVER] Forced exit after timeout");
    process.exit(1);
  }, config.gracefulShutdownMs);

  server.close(() => {
    clearTimeout(forceExit);
    console.log("[SERVER] Graceful shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
