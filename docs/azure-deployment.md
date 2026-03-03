# Azure Deployment Rehberi — IT Yardım Masası Botu

Bu döküman, botu Azure App Service üzerine deploy edip Microsoft Teams'te kullanıma almak için gereken tüm adımları içerir.

---

## Ön Gereksinimler

- Aktif bir **Azure aboneliği** (ücretsiz deneme de olur)
- **Azure CLI** kurulu: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
- **Node.js 18+** ve **npm**
- **Microsoft Teams** yönetici erişimi (sideloading veya admin onayı için)
- ManageEngine ServiceDesk Plus **API token**'ı hazır

---

## 1. Azure'a Giriş

```bash
az login
```

Tarayıcı açılacak, Azure hesabınızla giriş yapın. Birden fazla aboneliğiniz varsa:

```bash
az account list --output table
az account set --subscription "Abonelik-Adı-veya-ID"
```

---

## 2. Resource Group Oluşturma

```bash
az group create --name rg-helpdesk-bot --location westeurope
```

> Türkiye'ye en yakın bölgeler: `westeurope` (Hollanda) veya `germanywestcentral` (Frankfurt).

---

## 3. App Service Plan Oluşturma

```bash
az appservice plan create \
  --name plan-helpdesk-bot \
  --resource-group rg-helpdesk-bot \
  --sku B1 \
  --is-linux
```

| SKU | Açıklama | Fiyat (yaklaşık) |
|-----|----------|-------------------|
| F1 | Free — test için (sınırlı, always-on yok) | Ücretsiz |
| B1 | Basic — production minimum | ~$13/ay |
| S1 | Standard — auto-scale, slot desteği | ~$70/ay |

> **Not:** F1'de "Always On" özelliği yoktur, bot 20 dk inaktivite sonrası uyur. Production için en az **B1** kullanın.

---

## 4. Web App Oluşturma

```bash
az webapp create \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --plan plan-helpdesk-bot \
  --runtime "NODE|18-lts"
```

> `helpdesk-bot-klimasan` benzersiz olmalı (global DNS). Kendi adınızı seçin.

Startup command ayarlayın:

```bash
az webapp config set \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --startup-file "node dist/index.js"
```

---

## 5. Azure Bot Kaydı (Bot Channels Registration)

### 5.1 App Registration (Azure AD)

```bash
# App Registration oluştur
az ad app create --display-name "helpdesk-bot-app"
```

Çıktıdan `appId` değerini not edin. Sonra client secret oluşturun:

```bash
az ad app credential reset \
  --id <APP_ID> \
  --append
```

Çıktıdaki `password` değerini not edin. Bu değerler:
- `appId` → `MicrosoftAppId`
- `password` → `MicrosoftAppPassword`

### 5.2 Azure Bot Resource

```bash
az bot create \
  --resource-group rg-helpdesk-bot \
  --name helpdesk-bot-klimasan \
  --kind registration \
  --endpoint "https://helpdesk-bot-klimasan.azurewebsites.net/api/messages" \
  --app-type MultiTenant \
  --appid <APP_ID>
```

### 5.3 Teams Kanalını Etkinleştir

```bash
az bot msteams create \
  --resource-group rg-helpdesk-bot \
  --name helpdesk-bot-klimasan
```

Veya **Azure Portal** → Bot resource → Channels → Microsoft Teams → Enable.

---

## 6. Ortam Değişkenlerini Ayarlama

```bash
az webapp config appsettings set \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --settings \
    MicrosoftAppId="<APP_ID>" \
    MicrosoftAppPassword="<APP_SECRET>" \
    MicrosoftAppType="MultiTenant" \
    PORT="8080" \
    OLLAMA_BASE_URL="http://<OLLAMA_SUNUCU_IP>:11434" \
    OLLAMA_MODEL="llama3:8b" \
    MANAGE_ENGINE_ENDPOINT="https://servicedesk.klimasan.com.tr/api/v3/requests" \
    MANAGE_ENGINE_AUTHTOKEN="<TOKEN>" \
    WEBSITE_NODE_DEFAULT_VERSION="~18"
```

> **ÖNEMLİ — Ollama erişimi:**
> Azure App Service, `localhost` üzerinden Ollama'ya erişemez çünkü Ollama sizin lokal/on-prem sunucunuzdadır. Seçenekler:
>
> | Yöntem | Açıklama |
> |--------|----------|
> | **VPN / ExpressRoute** | Kurumsal ağınızı Azure'a bağlayın, internal IP kullanın |
> | **Azure VM'de Ollama** | GPU'lu VM kiralayın, Ollama'yı orada çalıştırın |
> | **Reverse proxy (ngrok/Cloudflare Tunnel)** | On-prem Ollama'yı dışarıya açın (test için) |
> | **Hybrid**: Bot on-prem, sadece Bot Registration Azure'da | Bot sunucunuz kendi ağınızda çalışır (tavsiye edilen) |

---

## 7. Projeyi Deploy Etme

### Yöntem A: ZIP Deploy (Basit)

```bash
# Proje dizininde
npm install
npm run build

# Deploy paketi oluştur
zip -r deploy.zip dist/ node_modules/ package.json
```

> **Windows PowerShell** kullanıyorsanız:
> ```powershell
> Compress-Archive -Path dist, node_modules, package.json -DestinationPath deploy.zip
> ```

```bash
az webapp deploy \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --src-path deploy.zip \
  --type zip
```

### Yöntem B: Git Deploy (CI/CD)

```bash
# Local git deploy ayarla
az webapp deployment source config-local-git \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot
```

Çıktıdaki Git URL'ini kopyalayın, sonra:

```bash
git init
git add -A
git commit -m "Initial deployment"
git remote add azure <GIT_URL>
git push azure main
```

### Yöntem C: GitHub Actions (Otomatik CI/CD)

Azure Portal → Web App → Deployment Center → GitHub → Repo seçin.

Veya bu workflow dosyasını `.github/workflows/deploy.yml` olarak ekleyin:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - run: npm install
      - run: npm run build

      - uses: azure/webapps-deploy@v3
        with:
          app-name: helpdesk-bot-klimasan
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .
```

Publish profile'ı Azure Portal → Web App → Get publish profile'dan indirip GitHub repo Settings → Secrets'a `AZURE_WEBAPP_PUBLISH_PROFILE` olarak ekleyin.

---

## 8. Teams'e Botu Yükleme

### 8.1 Manifest Güncelleme

[appPackage/manifest.json](../appPackage/manifest.json) dosyasındaki `${{BOT_ID}}` yerine gerçek App ID'nizi yazın:

```json
"bots": [
  {
    "botId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    ...
  }
]
```

### 8.2 App Paketi Oluşturma

`manifest.json`, `outline.png` ve `color.png` dosyalarını **tek bir ZIP** dosyasına sıkıştırın:

```bash
cd appPackage
zip ../helpdesk-bot.zip manifest.json outline.png color.png
```

### 8.3 Teams'e Yükleme

**Sideloading (Test için):**
1. Microsoft Teams → Apps → Manage your apps
2. "Upload an app" → "Upload a custom app"
3. ZIP dosyasını seçin
4. Botu açın ve mesaj gönderin

**Organizasyon genelinde yayın (Production):**
1. Teams Admin Center → Manage apps
2. "Upload new app" → ZIP dosyasını yükleyin
3. App'i onaylayın ve kullanıcılara/gruplara atayın

---

## 9. Doğrulama ve Test

### Health Check

```bash
curl https://helpdesk-bot-klimasan.azurewebsites.net/health
# Beklenen: {"status":"ok","timestamp":"2026-..."}
```

### Logları İzleme

```bash
# Gerçek zamanlı log stream
az webapp log tail \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot

# Application logging aç
az webapp log config \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --application-logging filesystem \
  --level information
```

### Teams'te Test

1. Teams'te botu açın
2. "Mavi ekran hatası alıyorum" yazın
3. Sırasıyla şunları görmelisiniz:
   - "Talebiniz alındı. Destek bileti oluşturuluyor..."
   - "Destek talebiniz başarıyla oluşturuldu! Talep #12345..."

---

## 10. Always On ve Performans

```bash
# Always On'u aç (B1+ gerektirir, bot uyumasın)
az webapp config set \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --always-on true

# WebSockets aç (Bot Framework için önerilen)
az webapp config set \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --web-sockets-enabled true
```

---

## 11. Sorun Giderme

| Sorun | Kontrol |
|-------|---------|
| Bot yanıt vermiyor | Health endpoint'i kontrol edin, logları inceleyin |
| 401 Unauthorized | `MicrosoftAppId` ve `MicrosoftAppPassword` doğru mu? |
| Ollama timeout | Azure'dan Ollama sunucusuna erişim var mı? VPN/tunnel aktif mi? |
| ManageEngine hatası | `MANAGE_ENGINE_AUTHTOKEN` geçerli mi? SSL sertifika sorunu? |
| Teams'te "App not responding" | Always On açık mı? Messaging endpoint doğru mu? |
| 502 Bad Gateway | `startup-file` ayarı doğru mu? `npm run build` başarılı mı? |

### Yararlı Komutlar

```bash
# App'i yeniden başlat
az webapp restart --name helpdesk-bot-klimasan --resource-group rg-helpdesk-bot

# Ortam değişkenlerini listele
az webapp config appsettings list --name helpdesk-bot-klimasan --resource-group rg-helpdesk-bot --output table

# SSH ile bağlan (debug için)
az webapp ssh --name helpdesk-bot-klimasan --resource-group rg-helpdesk-bot
```

---

## 12. Maliyet Tahmini (Aylık)

| Kaynak | SKU | Yaklaşık Maliyet |
|--------|-----|-------------------|
| App Service Plan | B1 | ~$13 |
| Bot Channels Registration | Free | $0 |
| App Registration (Azure AD) | Free | $0 |
| **Toplam (Ollama on-prem ise)** | | **~$13/ay** |

> Ollama'yı Azure VM'de çalıştırırsanız GPU VM maliyeti eklenecektir (NC4as_T4 v3 ~$350/ay). On-prem Ollama + VPN çok daha ekonomiktir.

---

## Mimari Özet

```
Kullanıcı (Teams)
    │
    ▼
Microsoft Teams Service
    │
    ▼
Azure Bot Service (Channel Registration)
    │
    ▼
Azure App Service (Node.js bot)  ← Bu projenin deploy edildiği yer
    │
    ├──► Ollama (on-prem veya Azure VM)
    │         └─ llama3:8b → ticket başlığı üret
    │
    └──► ManageEngine ServiceDesk Plus (on-prem)
              └─ Ticket oluştur + attachment yükle
```
