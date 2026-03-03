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
      "Sen kurumsal bir IT bilet başlığı oluşturucususun.",
      "Görevin, kullanıcı mesajını şu 3 parçalı formüle göre başlığa dönüştürmektir:",
      "[Hizmet/Cihaz Adı] + [Spesifik Sorun Detayı] + [Talep/Hata Türü]",
      "",
      "KESİN KURALLAR:",
      "- Başlık tam olarak 5 ile 8 kelime arasında olmalıdır. ASLA DAHA KISA YAZMA.",
      "- Çıktı sadece başlık metni olmalıdır, başka hiçbir açıklama yapma.",
      "- Eğer başlık kısa kalırsa, sonuna 'Hakkında Destek Talebi' veya 'Erişim Sorunu Bildirimi' ekleyerek 5 kelimeye tamamla.",
      "",
      "ÖRNEK FORMÜL UYGULAMASI:",
      "Girdi: 'VPN bağlanmıyor'",
      "Çıktı: Kurumsal VPN Portalı Bağlantı Sorunu Destek Talebi",
      "",
      "Girdi: 'Excel hata veriyor'",
      "Çıktı: Microsoft Excel Uygulaması Beklenmedik Dosya Hatası Bildirimi",
    ].join("\n");

    const fewShotMessages = [
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
