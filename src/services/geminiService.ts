import fetch from "node-fetch";
import { config } from "../config";

/**
 * Sends the user message to Gemini API and returns a short ticket title (5-10 words).
 */
export async function generateTicketTitle(
  userMessage: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.geminiTimeoutMs
  );

  try {
    const systemInstruction = [
      "You are an IT helpdesk ticket title generator for a Turkish-speaking company.",
      "The user's message is in Turkish. Generate a short ticket title in TURKISH.",
      "",
      "Rules:",
      "- Title must be 5-10 words in Turkish",
      "- Output ONLY the title, nothing else",
      "- No quotes, no explanations, no numbering, no prefixes like 'Başlık:'",
      "- Keep IT terminology as-is (e.g. VPN, Outlook, SAP, printer, Excel)",
    ].join("\n");

    const fewShotMessages = [
      {
        role: "user",
        parts: [{ text: "Bilgisayarım açılmıyor sabahtan beri mavi ekran veriyor" }],
      },
      {
        role: "model",
        parts: [{ text: "Bilgisayar Açılmıyor Mavi Ekran Hatası" }],
      },
      {
        role: "user",
        parts: [{ text: "Outlook mail gönderemiyorum hata alıyorum" }],
      },
      {
        role: "model",
        parts: [{ text: "Outlook Mail Gönderim Hatası" }],
      },
      {
        role: "user",
        parts: [{ text: "VPN bağlantısı sürekli kopuyor evden çalışamıyorum" }],
      },
      {
        role: "model",
        parts: [{ text: "VPN Bağlantı Kopma Sorunu" }],
      },
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ];

    const url = `${config.geminiBaseUrl}/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: fewShotMessages,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 50,
        },
      }),
      signal: controller.signal as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini API returned ${response.status}: ${errorText}`
      );
    }

    const data = (await response.json()) as any;

    const raw =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Take only the first line, strip quotes and whitespace
    const title = raw
      .split("\n")[0]
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .trim();

    if (!title) {
      throw new Error("Gemini returned an empty title");
    }

    console.log(`[GEMINI] Generated title: "${title}"`);
    return title;
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[GEMINI] Request timed out");
      throw new Error("Gemini request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
