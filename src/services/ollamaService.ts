import fetch, { AbortError } from "node-fetch";
import { config } from "../config";

/**
 * Sends the user message to Ollama and returns a short ticket title (5-10 words).
 */
export async function generateTicketTitle(
  userMessage: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.ollamaTimeoutMs
  );

  try {
    const prompt = [
      "You are an IT helpdesk ticket title generator for a Turkish-speaking company.",
      "The user's message is in Turkish. Generate a short ticket title in TURKISH.",
      "",
      "Rules:",
      "- Title must be 5-10 words in Turkish",
      "- Output ONLY the title, nothing else",
      "- No quotes, no explanations, no numbering, no prefixes like 'Başlık:'",
      "- Keep IT terminology as-is (e.g. VPN, Outlook, SAP, printer, Excel)",
      "",
      "Examples:",
      "User: Bilgisayarım açılmıyor sabahtan beri mavi ekran veriyor",
      "Title: Bilgisayar Açılmıyor Mavi Ekran Hatası",
      "",
      "User: Outlook mail gönderemiyorum hata alıyorum",
      "Title: Outlook Mail Gönderim Hatası",
      "",
      "User: VPN bağlantısı sürekli kopuyor evden çalışamıyorum",
      "Title: VPN Bağlantı Kopma Sorunu",
      "",
      `User: ${userMessage}`,
      "Title:",
    ].join("\n");

    const response = await fetch(
      `${config.ollamaBaseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.ollamaModel,
          prompt,
          stream: false,
        }),
        signal: controller.signal as any,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Ollama returned ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as { response: string };
    const raw = data.response || "";

    // Take only the first line, strip quotes and whitespace
    const title = raw
      .split("\n")[0]
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .trim();

    if (!title) {
      throw new Error("Ollama returned an empty title");
    }

    console.log(`[OLLAMA] Generated title: "${title}"`);
    return title;
  } catch (err) {
    if (err instanceof AbortError) {
      console.error("[OLLAMA] Request timed out");
      throw new Error("Ollama request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
