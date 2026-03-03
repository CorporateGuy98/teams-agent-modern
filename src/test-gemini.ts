import * as dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const userMessage = process.argv[2];

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY .env dosyasında tanımlı değil!");
  process.exit(1);
}

if (!userMessage) {
  console.log(
    'Kullanım: npx ts-node src/test-gemini.ts "sorununuzu yazın"'
  );
  console.log(
    'Örnek:    npx ts-node src/test-gemini.ts "Bilgisayarım açılmıyor mavi ekran veriyor"'
  );
  process.exit(1);
}

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
  "Çıktı: Kurumsal VPN Portalı Bağlantı Sorunu Destek Talebi (6 kelime)",
  "",
  "Girdi: 'Excel hata veriyor'",
  "Çıktı: Microsoft Excel Uygulaması Beklenmedik Dosya Hatası Bildirimi (6 kelime)"
].join("\n");

const contents = [
  {
    role: "user",
    parts: [{ text: userMessage }],
  },
];
async function main() {
  console.log("=== SYSTEM INSTRUCTION ===");
  console.log(systemInstruction);
  console.log("\n=== KULLANICI MESAJı ===");
  console.log(userMessage);
  console.log(`\n=== Gemini'ye gönderiliyor... ===`);
  console.log(`Model: ${GEMINI_MODEL}`);
  console.log(`URL: ${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent\n`);

  const start = Date.now();

  const url = `${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 50,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Hata: ${response.status}`);
    console.error(errorText);
    process.exit(1);
  }

  const data = (await response.json()) as any;
  const elapsed = Date.now() - start;

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const title = raw
    .trim()
    .split("\n")
    .filter((line: string) => line.trim().length > 0)[0] || "";

  const inputTokens = data.usageMetadata?.promptTokenCount || "?";
  const outputTokens = data.usageMetadata?.candidatesTokenCount || "?";

  console.log("=== RAW RESPONSE ===");
  console.log(raw);
  console.log("\n=== TEMİZLENMİŞ BAŞLIK ===");
  console.log(title);
  console.log(
    `\n(${elapsed}ms, input: ${inputTokens} token, output: ${outputTokens} token)`
  );
}

main().catch((err) => {
  console.error("Bağlantı hatası:", err.message);
  process.exit(1);
});
