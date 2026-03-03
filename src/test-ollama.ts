import * as dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:8b";

const userMessage = process.argv[2];

if (!userMessage) {
  console.log("Kullanım: npx ts-node src/test-ollama.ts \"sorununuzu yazın\"");
  console.log("Örnek:    npx ts-node src/test-ollama.ts \"Bilgisayarım açılmıyor mavi ekran veriyor\"");
  process.exit(1);
}

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

async function main() {
  console.log("=== PROMPT ===");
  console.log(prompt);
  console.log("\n=== Ollama'ya gönderiliyor... ===");
  console.log(`Model: ${OLLAMA_MODEL}`);
  console.log(`URL: ${OLLAMA_BASE_URL}/api/generate\n`);

  const start = Date.now();

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    console.error(`Hata: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const data = (await response.json()) as any;
  const elapsed = Date.now() - start;

  const raw = data.response || "";
  const title = raw
    .split("\n")[0]
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();

  console.log("=== RAW RESPONSE ===");
  console.log(raw);
  console.log("\n=== TEMİZLENMİŞ BAŞLIK ===");
  console.log(title);
  console.log(`\n(${elapsed}ms, ${data.eval_count || "?"} token)`);
}

main().catch((err) => {
  console.error("Bağlantı hatası:", err.message);
  process.exit(1);
});
