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
  "You are an IT helpdesk ticket title generator for a Turkish-speaking company.",
  "The user's message is in Turkish. Generate a short ticket title in TURKISH.",
  "",
  "Rules:",
  "- Title must be 5-10 words in Turkish",
  "- Output ONLY the title, nothing else",
  "- No quotes, no explanations, no numbering, no prefixes like 'Başlık:'",
  "- Keep IT terminology as-is (e.g. VPN, Outlook, SAP, printer, Excel)",
].join("\n");

const contents = [
  {
    role: "user",
    parts: [
      {
        text: "Bilgisayarım açılmıyor sabahtan beri mavi ekran veriyor",
      },
    ],
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
    parts: [
      {
        text: "VPN bağlantısı sürekli kopuyor evden çalışamıyorum",
      },
    ],
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
    .split("\n")[0]
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();

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
