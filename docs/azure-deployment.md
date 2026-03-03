# Azure Deployment Rehberi — IT Yardım Masası Botu (Gemini API)

Bu döküman, botu Azure App Service üzerine deploy edip Microsoft Teams'te kullanıma almak için
gereken tüm adımları **Azure Portal (web arayüzü)** üzerinden anlatır.

> Bu rehber `feature/gemini-api` branch'ı içindir. Ollama yerine **Google Gemini API**
> (veya opsiyonel olarak OpenAI API) kullanılır. VPN/tunnel gerekmez.

---

## Ön Gereksinimler

- Aktif bir **Azure aboneliği** (ücretsiz deneme de olur)
- **Node.js 18+** ve **npm** (lokalde build için)
- **Microsoft Teams** erişimi (sideloading izni olmalı)
- **Gemini API Key** — https://aistudio.google.com/apikey adresinden ücretsiz alınır
- **ManageEngine ServiceDesk Plus** API token'ı

---

## Adım 1 — Lokalde Build

Deploy öncesi projeyi lokalde derleyin:

```bash
# Gemini branch'ında olduğunuzdan emin olun
git checkout feature/gemini-api

npm install
npm run build
```

`dist/` klasörü oluşacak. Bu klasörü Azure'a yükleyeceğiz.

---

## Adım 2 — Azure'da Web App Oluşturma

### 2.1 Azure Portal'a giriş
1. Tarayıcıdan **portal.azure.com** adresine gidin
2. Azure hesabınızla giriş yapın

### 2.2 Resource Group oluşturma
1. Üst arama çubuğuna **"Resource groups"** yazın → tıklayın
2. **"+ Create"** butonuna tıklayın
3. Bilgileri doldurun:
   - **Subscription:** Aboneliğinizi seçin
   - **Resource group:** `rg-helpdesk-bot`
   - **Region:** `West Europe` (Türkiye'ye en yakın)
4. **"Review + create"** → **"Create"**

### 2.3 Web App oluşturma
1. Üst arama çubuğuna **"App Services"** yazın → tıklayın
2. **"+ Create"** → **"Web App"**
3. **Basics** sekmesi:
   - **Subscription:** Aboneliğiniz
   - **Resource Group:** `rg-helpdesk-bot` (az önce oluşturdunuz)
   - **Name:** `helpdesk-bot-klimasan` (benzersiz olmalı, kendi adınızı seçin)
   - **Publish:** Code
   - **Runtime stack:** `Node 18 LTS`
   - **Operating System:** `Linux`
   - **Region:** `West Europe`
4. **Pricing plan** bölümünde:
   - **"Create new"** ile yeni plan oluşturun
   - Plan adı: `plan-helpdesk-bot`
   - **SKU:** `Basic B1` (~$13/ay) seçin
   > ⚠️ Free (F1) seçmeyin — Always On özelliği yok, bot 20 dk sonra uyur.
5. Diğer sekmeleri varsayılan bırakın
6. **"Review + create"** → **"Create"**
7. Deployment tamamlanınca **"Go to resource"** tıklayın

### 2.4 Startup Command ayarlama
1. Web App sayfasında sol menüden **Configuration** → **General settings** sekmesi
2. **Startup Command** alanına yazın: `node dist/index.js`
3. Üstten **"Save"** → **"Continue"**

### 2.5 Always On ve WebSocket
Aynı **General settings** sayfasında:
1. **Always on:** `On` yapın
2. **Web sockets:** `On` yapın
3. **"Save"**

---

## Adım 3 — Azure Bot Kaydı

### 3.1 App Registration (kimlik oluşturma)

Bu adım bot'un kimliğini oluşturur. Teams, bu kimlik ile bot'unuzu tanır.

1. Portal üst arama çubuğuna **"Microsoft Entra ID"** yazın → tıklayın
   > (Eski adı: Azure Active Directory)
2. Sol menüden **"App registrations"** → **"+ New registration"**
3. Bilgileri doldurun:
   - **Name:** `helpdesk-bot-app`
   - **Supported account types:** `Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)`
   - **Redirect URI:** Boş bırakın
4. **"Register"** tıklayın
5. Açılan sayfada **"Application (client) ID"** değerini kopyalayın ve not edin
   > Bu sizin **MicrosoftAppId** değeriniz

### 3.2 Client Secret oluşturma

1. Aynı App Registration sayfasında sol menüden **"Certificates & secrets"**
2. **"+ New client secret"** tıklayın
3. **Description:** `bot-secret`
4. **Expires:** `24 months` (veya istediğiniz süre)
5. **"Add"** tıklayın
6. ⚠️ **"Value"** sütunundaki değeri HEMEN kopyalayın — sayfadan ayrılınca bir daha göremezsiniz!
   > Bu sizin **MicrosoftAppPassword** değeriniz

### 3.3 Azure Bot oluşturma

1. Portal üst arama çubuğuna **"Azure Bot"** yazın → tıklayın → **"+ Create"**
2. Bilgileri doldurun:
   - **Bot handle:** `helpdesk-bot-klimasan`
   - **Subscription:** Aboneliğiniz
   - **Resource group:** `rg-helpdesk-bot`
   - **Pricing tier:** `Free (F0)`
   - **Type of App:** `Multi Tenant`
   - **Creation type:** `Use existing app registration`
   - **App ID:** 3.1'de kopyaladığınız Application (client) ID
   - **App tenant ID:** Boş bırakın (multitenant)
3. **"Review + create"** → **"Create"**
4. Deployment tamamlanınca **"Go to resource"**

### 3.4 Messaging Endpoint ayarlama

1. Azure Bot sayfasında sol menüden **"Configuration"**
2. **Messaging endpoint** alanına yazın:
   ```
   https://helpdesk-bot-klimasan.azurewebsites.net/api/messages
   ```
   > `helpdesk-bot-klimasan` yerine 2.3'te verdiğiniz Web App adını yazın
3. **"Apply"** tıklayın

### 3.5 Teams kanalını etkinleştirme

1. Azure Bot sayfasında sol menüden **"Channels"**
2. **"Microsoft Teams"** ikonuna tıklayın
3. Lisans koşullarını kabul edin → **"Agree"**
4. **"Apply"** tıklayın
5. Channels listesinde Teams'in yanında ✅ göreceksiniz

---

## Adım 4 — Ortam Değişkenleri

### 4.1 Gemini API Key alma

1. Tarayıcıda **aistudio.google.com/apikey** adresine gidin
2. Google hesabınızla giriş yapın
3. **"Create API Key"** tıklayın
4. Key'i kopyalayın

### 4.2 Web App'e değişkenleri ekleme

1. Portal → **App Services** → `helpdesk-bot-klimasan` tıklayın
2. Sol menüden **"Configuration"** → **"Application settings"** sekmesi
3. **"+ New application setting"** butonuyla tek tek ekleyin:

| Name | Value | Açıklama |
|------|-------|----------|
| `MicrosoftAppId` | `xxxxxxxx-xxxx-...` | 3.1'den kopyaladığınız App ID |
| `MicrosoftAppPassword` | `xxxxxxxxx` | 3.2'den kopyaladığınız secret |
| `MicrosoftAppType` | `MultiTenant` | Sabit değer |
| `PORT` | `8080` | Azure App Service'in beklediği port |
| `GEMINI_API_KEY` | `AIzaSy...` | 4.1'den aldığınız Gemini key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Ucuz ve hızlı model |
| `MANAGE_ENGINE_ENDPOINT` | `https://servicedesk.klimasan.com.tr/api/v3/requests` | ServiceDesk Plus URL |
| `MANAGE_ENGINE_AUTHTOKEN` | `xxxxxxxx-xxxx-...` | ManageEngine API token |

4. Tüm değişkenleri ekledikten sonra üstten **"Save"** → **"Continue"**

> ⚠️ **PORT neden 8080?** Azure App Service, Linux container'larında uygulamanın
> 8080 portunu dinlemesini bekler. Koddaki `process.env.PORT` bunu otomatik alır.

### 4.3 OpenAI kullanmak isterseniz (Alternatif)

Gemini yerine OpenAI API kullanmak isterseniz kodda değişiklik gerekir,
ancak env değişkenleri benzer mantıkta olacaktır:

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-...` |
| `OPENAI_MODEL` | `gpt-4.1-nano` |

> Not: Bu rehber Gemini branch'ı içindir. OpenAI için ayrı bir branch gerekir.

---

## Adım 5 — Projeyi Deploy Etme

### Yöntem A: Portal üzerinden ZIP Deploy (En kolay)

**Lokalde:**
```bash
npm install
npm run build
```

**Windows PowerShell ile ZIP oluşturma:**
```powershell
Compress-Archive -Path dist, node_modules, package.json -DestinationPath deploy.zip -Force
```

**Bash / Git Bash ile:**
```bash
zip -r deploy.zip dist/ node_modules/ package.json
```

**Azure Portal'dan yükleme:**
1. Portal → App Services → `helpdesk-bot-klimasan`
2. Sol menüden **"Advanced Tools"** → **"Go →"** (Kudu açılır)
3. Üst menüden **"Tools"** → **"Zip Push Deploy"**
4. `deploy.zip` dosyanızı sürükleyip bırakın
5. Yükleme tamamlanınca uygulama otomatik yeniden başlar

### Yöntem B: Deployment Center (GitHub bağlantısı)

Projeyi GitHub'a push'ladıysanız:

1. Portal → App Services → `helpdesk-bot-klimasan`
2. Sol menüden **"Deployment Center"**
3. **Source:** `GitHub` seçin → GitHub hesabınızla bağlayın
4. **Organization / Repository / Branch** seçin (`feature/gemini-api`)
5. **"Save"**

Artık branch'a her push'ladığınızda otomatik deploy olur.

---

## Adım 6 — Teams'e Botu Yükleme

### 6.1 Manifest dosyasını güncelleme

`appPackage/manifest.json` dosyasını açın ve `${{BOT_ID}}` yazan yeri
**3.1'de kopyaladığınız App ID** ile değiştirin:

```json
"bots": [
  {
    "botId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "scopes": ["personal"],
    ...
  }
]
```

> Scope'u sadece `["personal"]` bırakın — test aşamasında yalnızca siz erişirsiniz.

### 6.2 App paketi oluşturma

`appPackage/` klasöründeki 3 dosyayı **tek bir ZIP** dosyasına sıkıştırın:
- `manifest.json`
- `outline.png`
- `color.png`

**Windows'ta:** 3 dosyayı seçin → Sağ tık → "Sıkıştırılmış klasöre gönder"

### 6.3 Teams'e sideload (sadece siz görürsünüz)

1. **Microsoft Teams** uygulamasını açın
2. Sol menüden **"Apps"** (Uygulamalar)
3. Alt kısımda **"Manage your apps"** (Uygulamalarınızı yönetin)
4. **"Upload an app"** → **"Upload a custom app"**
5. ZIP dosyasını seçin
6. **"Add"** (Ekle) tıklayın
7. Bot sohbet penceresi açılacak — mesaj yazarak test edin

### 6.4 Test

Bot'a şunu yazın:
```
Bilgisayarım çok yavaş açılıyor
```

Beklenen sonuç:
1. ✅ "Talebiniz alındı. Destek bileti oluşturuluyor, lütfen bekleyin..."
2. ✅ "Destek talebiniz başarıyla oluşturuldu!
   **Talep #12345**
   **Başlık:** Bilgisayar Yavaş Açılma Sorunu"

---

## Adım 7 — Doğrulama ve Sorun Giderme

### Health Check

Tarayıcıdan şu adrese gidin:
```
https://helpdesk-bot-klimasan.azurewebsites.net/health
```
Beklenen cevap: `{"status":"ok","timestamp":"2026-..."}`

### Log İzleme (Portal)

1. Portal → App Services → `helpdesk-bot-klimasan`
2. Sol menüden **"Log stream"**
3. Gerçek zamanlı logları göreceksiniz
4. Bot'a mesaj yazın, logların aktığını kontrol edin

### Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|-------|-------|
| Health endpoint çalışmıyor | Startup command doğru mu? (`node dist/index.js`) |
| `Application Error` | Log stream'den hatayı okuyun. Genelde env değişkeni eksik. |
| Bot Teams'te yanıt vermiyor | Messaging endpoint doğru mu? App ID/Password eşleşiyor mu? |
| `GEMINI_API_KEY is required` | Application settings'e GEMINI_API_KEY eklenmemiş |
| Gemini 403 hatası | API key'in geçerliliğini kontrol edin, aistudio.google.com/apikey |
| ManageEngine bağlantı hatası | Azure'dan `servicedesk.klimasan.com.tr` erişilebiliyor mu? |
| Teams'te "App not responding" | Always On açık mı? Web App çalışıyor mu? |
| 502 Bad Gateway | Web App yeniden başlatın: Overview → Restart |

### Web App'i Yeniden Başlatma

Portal → App Services → `helpdesk-bot-klimasan` → Üstteki **"Restart"** butonu

---

## Adım 8 — Production'a Geçiş

Test başarılı olduktan sonra botu tüm organizasyona açmak için:

1. **Teams Admin Center** → https://admin.teams.microsoft.com
2. Sol menü → **"Teams apps"** → **"Manage apps"**
3. **"Upload new app"** → Aynı ZIP dosyasını yükleyin
4. App'i bulun → **"Publish"** veya **"Allow"** yapın
5. İstenirse **"Setup policies"** ile belirli kullanıcı/gruplara atayın

---

## Maliyet Özeti (Aylık)

| Kaynak | Maliyet |
|--------|---------|
| Azure App Service (B1) | ~$13 |
| Azure Bot Registration | $0 (Free) |
| App Registration (Entra ID) | $0 |
| Gemini API (1500 istek/ay) | ~$0.05 |
| **Toplam** | **~$13/ay** |

> OpenAI kullanırsanız: GPT-4.1-nano ile ~$0.05/ay, GPT-4.1-mini ile ~$0.17/ay.
> API maliyeti ihmal edilebilir düzeydedir.

---

## Mimari Özet

```
Kullanıcı (Teams)
    │
    ▼
Microsoft Teams Cloud
    │
    ▼
Azure Bot Service (Channel Registration — ücretsiz)
    │
    ▼
Azure App Service (Node.js bot — B1 plan)
    │
    ├──► Google Gemini API (internet üzerinden)
    │         └─ gemini-2.0-flash → ticket başlığı üret
    │
    └──► ManageEngine ServiceDesk Plus
              └─ Ticket oluştur + attachment yükle
```

> ✅ VPN/tunnel gerekmez (Gemini internet üzerinden erişilir)
> ⚠️ ManageEngine dışarıdan erişilebilir olmalı. Değilse sadece ManageEngine için
> Hybrid Connection kullanın (bkz. vpn-ollama-erisim.md)
