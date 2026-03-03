import { config } from "../config";

export function validateEnv(): void {
  const errors: string[] = [];

  if (!config.manageEngineAuthToken) {
    errors.push(
      "MANAGE_ENGINE_AUTHTOKEN is required but not set. Application cannot start."
    );
  }

  if (!config.manageEngineEndpoint) {
    errors.push("MANAGE_ENGINE_ENDPOINT is required but not set.");
  }

  if (!config.geminiApiKey) {
    errors.push(
      "GEMINI_API_KEY is required but not set. Application cannot start."
    );
  }

  // Azure credentials are optional (empty = Emulator mode)
  if (!config.microsoftAppId) {
    console.warn(
      "[ENV] MicrosoftAppId is empty — running in Emulator/local mode."
    );
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`[ENV ERROR] ${err}`);
    }
    process.exit(1);
  }

  console.log("[ENV] Environment validation passed.");
}
