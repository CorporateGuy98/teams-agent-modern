# IT Yardım Masası Botu — Geliştirme Rehberi

## 1. Ön Gereksinimler

- **Node.js** 18+ ve **npm**
- **TypeScript** (global veya devDependency olarak)
- **Bot Framework Emulator** (lokal test için): https://github.com/microsoft/BotFramework-Emulator/releases
- **Ollama** (LLM inference için)
- **ManageEngine ServiceDesk Plus** erişimi (trial veya production)

---

## 2. Ollama Kurulumu

### Windows
1. https://ollama.com/download adresinden Ollama'yı indirin ve kurun
2. Terminal açın:
   ```bash
   ollama pull llama3.1:8b
   ollama serve
   ```
3. Ollama varsayılan olarak `http://localhost:11434` üzerinde çalışır
4. Test edin:
   ```bash
   curl http://localhost:11434/api/generate -d '{
     "model": "llama3.1:8b",
     "prompt": "Say hello",
     "stream": false
   }'
   ```

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b
ollama serve
```

---

## 3. ManageEngine ServiceDesk Plus

### Trial Signup
1. https://www.manageengine.com/products/service-desk/download.html adresinden trial indirin
2. Kurulum sonrası admin panelinden **API Key** oluşturun:
   - Admin → Technicians → ilgili kullanıcı → Generate API Key
3. API Key'i `.env` dosyasındaki `MANAGE_ENGINE_AUTHTOKEN` alanına yazın

### API Test
```bash
curl -k -X POST "https://servicedesk.klimasan.com.tr/api/v3/requests" \
  -H "authtoken: YOUR_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'input_data={"request":{"subject":"Test Ticket","description":"API test","requester":{"name":"Admin"}}}'
```

---

## 4. Lokal Geliştirme (Emulator)

### Kurulum
```bash
# Proje dizininde:
npm install
cp .env.example .env
# .env dosyasını düzenleyin — MicrosoftAppId ve MicrosoftAppPassword boş bırakılabilir
```

### Build & Çalıştırma
```bash
npm run build
npm start
```
Bot `http://localhost:3978/api/messages` üzerinde çalışmaya başlar.

### Bot Framework Emulator ile Test
1. Emulator'ü açın
2. "Open Bot" → URL: `http://localhost:3978/api/messages`
3. Microsoft App ID ve Password boş bırakın
4. "Connect" yapın
5. Mesaj yazarak test edin

### Geliştirme Döngüsü
```bash
# Terminal 1 — TypeScript watch mode
npm run watch

# Terminal 2 — Sunucuyu başlat (her build sonrası yeniden başlatın)
npm start
```

---

## 5. Teams'te Test (ngrok + Azure Bot)

### 5.1 ngrok ile Tunnel
```bash
ngrok http 3978
# Örnek çıktı: https://abc123.ngrok.io
```

### 5.2 Azure Bot Kaydı
1. https://portal.azure.com → "Azure Bot" kaynağı oluşturun
2. **Messaging endpoint**: `https://abc123.ngrok.io/api/messages`
3. **App ID** ve **Password** oluşturun
4. Bu değerleri `.env` dosyasına yazın:
   ```
   MicrosoftAppId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   MicrosoftAppPassword=your-client-secret
   ```
5. Bot Channels → Microsoft Teams'i etkinleştirin

### 5.3 Teams'e Sideload
1. `appPackage/manifest.json` içindeki `${{BOT_ID}}` yerine Azure Bot App ID'nizi yazın
2. `manifest.json`, `outline.png`, `color.png` dosyalarını zip'leyin
3. Teams → Apps → Upload a custom app → zip dosyasını yükleyin
4. Botla sohbet başlatın

---

## 6. M365 Agents Toolkit ile Geliştirme

VS Code'da **Microsoft 365 Agents Toolkit** eklentisi kuruluysa:

1. **F5** tuşuna basarak lokal debug başlatın
2. Toolkit otomatik olarak:
   - Dev tunnel oluşturur
   - Bot'u Azure'a kaydeder
   - Teams'e sideload yapar
3. `teamsapp.local.yml` dosyasındaki lifecycle hook'ları çalışır

---

## 7. Production Deployment (PM2)

### PM2 Kurulumu
```bash
npm install -g pm2
```

### Build & Deploy
```bash
npm install
npm run build
```

### PM2 ile Başlatma
```bash
pm2 start dist/index.js --name helpdesk-bot
pm2 save
pm2 startup   # Sistem başlangıcında otomatik çalıştırma
```

### PM2 Komutları
```bash
pm2 status           # Durum kontrolü
pm2 logs helpdesk-bot  # Log izleme
pm2 restart helpdesk-bot  # Yeniden başlatma
pm2 stop helpdesk-bot     # Durdurma
```

### Ecosystem Dosyası (Opsiyonel)
`ecosystem.config.js` oluşturun:
```js
module.exports = {
  apps: [{
    name: "helpdesk-bot",
    script: "dist/index.js",
    instances: 1,
    env: {
      NODE_ENV: "production",
      PORT: 3978
    },
    max_restarts: 10,
    restart_delay: 5000
  }]
};
```

```bash
pm2 start ecosystem.config.js
```

---

## 8. Ortam Değişkenleri Referansı

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `MicrosoftAppId` | Hayır* | Azure Bot App ID (*Emulator'da boş) |
| `MicrosoftAppPassword` | Hayır* | Azure Bot Secret (*Emulator'da boş) |
| `MicrosoftAppType` | Hayır | Varsayılan: MultiTenant |
| `PORT` | Hayır | Varsayılan: 3978 |
| `OLLAMA_BASE_URL` | Hayır | Varsayılan: http://localhost:11434 |
| `OLLAMA_MODEL` | Hayır | Varsayılan: llama3.1:8b |
| `MANAGE_ENGINE_ENDPOINT` | Evet | ServiceDesk Plus API URL |
| `MANAGE_ENGINE_AUTHTOKEN` | Evet | API auth token |

---

## 9. Sorun Giderme

### Ollama bağlantı hatası
- `ollama serve` çalışıyor mu kontrol edin
- `OLLAMA_BASE_URL` doğru mu?
- Firewall 11434 portunu engelliyor olabilir

### ManageEngine 401/403 hatası
- `MANAGE_ENGINE_AUTHTOKEN` doğru mu?
- Token'ın süresi dolmamış mı?
- Self-signed sertifika sorunu: kod zaten `rejectUnauthorized: false` kullanıyor

### Teams'te bot yanıt vermiyor
- ngrok tunnel aktif mi?
- Azure Bot messaging endpoint doğru mu?
- `MicrosoftAppId` ve `MicrosoftAppPassword` doğru mu?
- Bot Channel Registration'da Teams kanalı aktif mi?
