# Azure → On-Prem Ollama Erişim Rehberi

Azure App Service'deki bot, şirket ağınızdaki Ollama sunucusuna erişmek zorunda.
Bu döküman tüm yöntemleri basittenkarmaşığa doğru açıklar.

---

## Yöntemlerin Karşılaştırması

| Yöntem | Zorluk | Maliyet | Güvenlik | Production'a Uygun |
|--------|--------|---------|----------|---------------------|
| Cloudflare Tunnel | Kolay | Ücretsiz | Orta | Test / küçük ölçek |
| Azure Hybrid Connection | Orta | Ücretsiz (B1+) | Yüksek | Evet (TAVSİYE) |
| Azure VPN Gateway (S2S) | Zor | ~$27+/ay | Çok yüksek | Kurumsal |
| Bot'u on-prem çalıştır | Kolay | $0 | Yüksek | Evet |

---

## Yöntem 1: Azure Hybrid Connection (TAVSİYE EDİLEN)

En pratik yöntem. Azure tarafında VNet gerekmez, on-prem'de sadece küçük bir agent kurarsınız.

### Nasıl Çalışır

```
Azure App Service
    │
    ▼ (Hybrid Connection — outbound relay)
Azure Relay (Service Bus)
    ▲
    │ (outbound bağlantı — firewall açmaya gerek yok)
Hybrid Connection Manager (on-prem Windows sunucu)
    │
    ▼
Ollama (localhost:11434 veya 192.168.x.x:11434)
```

- On-prem'den Azure'a **outbound** bağlantı kurar (firewall'da port açmanıza gerek yok)
- App Service, sanki local bir adrese bağlanıyormuş gibi on-prem'e erişir

### Adım 1: Azure Portal'da Hybrid Connection Oluşturma

1. Azure Portal → App Service → **Networking** → **Hybrid connections**
2. **Add hybrid connection** → **Create new hybrid connection**
3. Şu bilgileri girin:
   - **Name:** `ollama-relay`
   - **Endpoint Host:** Ollama'nın çalıştığı makinenin hostname'i veya IP'si
     - Aynı makineyse: `OLLAMA-SERVER` (hostname) veya IP adresi
     - Farklı makineyse: `192.168.1.50` gibi internal IP
   - **Endpoint Port:** `11434`
   - **Service Bus Namespace:** Yeni oluşturun → `sb-helpdesk-ollama`
4. **OK** ile kaydedin

### Adım 2: On-Prem'e Hybrid Connection Manager Kurulumu

1. Azure Portal → App Service → Networking → Hybrid connections
2. Oluşturduğunuz connection'ın yanındaki **Download connection manager** butonuna tıklayın
3. İndirilen MSI'yi **Ollama'nın çalıştığı Windows sunucuya** kurun
   - Veya aynı ağdaki herhangi bir Windows sunucuya
4. Kurulum sonrası **Hybrid Connection Manager UI** açılır
5. **Add** → Azure aboneliğinizle giriş yapın → `ollama-relay` seçin → **Save**
6. Status **Connected** olmalı

> **Linux sunucu kullanıyorsanız:** Hybrid Connection Manager sadece Windows'ta çalışır.
> Ağınızda bir Windows makine olmalı (Ollama sunucusuyla aynı makine olmak zorunda değil,
> aynı ağda olması yeterli).

### Adım 3: App Service Ortam Değişkenini Güncelleme

```bash
az webapp config appsettings set \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --settings OLLAMA_BASE_URL="http://OLLAMA-SERVER:11434"
```

> Buradaki `OLLAMA-SERVER` hostname, Hybrid Connection'da girdiğiniz **Endpoint Host** ile
> birebir aynı olmalı. IP girdiyseniz IP yazın.

### Adım 4: Test

```bash
# App Service'in Kudu konsolundan (Advanced Tools → Go → Debug console):
curl http://OLLAMA-SERVER:11434/api/tags
```

Ollama'daki model listesini görüyorsanız bağlantı çalışıyor demektir.

### Önemli Notlar

- Hybrid Connection **B1 ve üzeri** App Service planlarında çalışır (F1'de yok)
- B1 planında **25 adet** hybrid connection ücretsiz
- Outbound bağlantıdır, firewall'da port açmanıza **gerek yoktur**
- Bağlantı şifreli (TLS over WebSocket)

---

## Yöntem 2: Cloudflare Tunnel (Test için Hızlı)

Firewall'da hiçbir şey açmadan Ollama'yı dışarıya güvenli şekilde açar.

### Kurulum

1. Cloudflare hesabı açın (ücretsiz)
2. Bir domain ekleyin veya Cloudflare'ın verdiği `*.cfargotunnel.com` subdomain'i kullanın
3. Ollama sunucusuna `cloudflared` kurun:

```bash
# Windows
winget install cloudflare.cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

4. Tunnel oluşturun:

```bash
cloudflared tunnel login
cloudflared tunnel create ollama-tunnel
```

5. Config dosyası oluşturun (`~/.cloudflared/config.yml`):

```yaml
tunnel: <TUNNEL_ID>
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: ollama.sizindomain.com
    service: http://localhost:11434
  - service: http_status:404
```

6. DNS kaydı ekleyin ve tunnel'ı başlatın:

```bash
cloudflared tunnel route dns ollama-tunnel ollama.sizindomain.com
cloudflared tunnel run ollama-tunnel
```

7. Azure App Service'de ortam değişkenini güncelleyin:

```bash
az webapp config appsettings set \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --settings OLLAMA_BASE_URL="https://ollama.sizindomain.com"
```

### Güvenlik Uyarısı

Ollama'nın kendisinde auth yoktur. Cloudflare Tunnel ile açarsanız:
- **Cloudflare Access** ile IP/email bazlı erişim kısıtlaması ekleyin
- Veya tunnel'ı sadece Azure App Service'in outbound IP'lerine izin verecek şekilde kısıtlayın:

```bash
# Azure App Service'in outbound IP'lerini öğrenin:
az webapp show --name helpdesk-bot-klimasan --resource-group rg-helpdesk-bot --query outboundIpAddresses
```

---

## Yöntem 3: Azure VPN Gateway (Site-to-Site)

Kurumsal çözüm. Tüm Azure kaynakları şirket ağına erişebilir.

### Gereksinimler

- Şirket tarafında VPN destekli router/firewall (FortiGate, Cisco ASA, pfSense vb.)
- Statik public IP
- Azure VPN Gateway (~$27+/ay)

### Adımlar (Özet)

```bash
# 1. Virtual Network oluştur
az network vnet create \
  --name vnet-helpdesk \
  --resource-group rg-helpdesk-bot \
  --address-prefix 10.0.0.0/16 \
  --subnet-name subnet-default \
  --subnet-prefix 10.0.1.0/24

# 2. Gateway subnet ekle
az network vnet subnet create \
  --name GatewaySubnet \
  --resource-group rg-helpdesk-bot \
  --vnet-name vnet-helpdesk \
  --address-prefix 10.0.255.0/27

# 3. Public IP oluştur
az network public-ip create \
  --name pip-vpn-gateway \
  --resource-group rg-helpdesk-bot \
  --allocation-method Static \
  --sku Standard

# 4. VPN Gateway oluştur (~30-45 dk sürer)
az network vnet-gateway create \
  --name vpn-gateway-helpdesk \
  --resource-group rg-helpdesk-bot \
  --vnet vnet-helpdesk \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw1 \
  --public-ip-address pip-vpn-gateway

# 5. Local Network Gateway (şirket tarafı)
az network local-gateway create \
  --name lng-klimasan \
  --resource-group rg-helpdesk-bot \
  --gateway-ip-address <SIRKET_PUBLIC_IP> \
  --local-address-prefixes 192.168.0.0/16

# 6. Bağlantı oluştur
az network vpn-connection create \
  --name conn-klimasan \
  --resource-group rg-helpdesk-bot \
  --vnet-gateway1 vpn-gateway-helpdesk \
  --local-gateway2 lng-klimasan \
  --shared-key "<PRESHARED_KEY>"

# 7. App Service'i VNet'e bağla
az webapp vnet-integration add \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --vnet vnet-helpdesk \
  --subnet subnet-default
```

Sonra şirket tarafındaki firewall/router'da aynı shared key ile IPSec tunnel yapılandırın.

Bu yapıldıktan sonra App Service, internal IP üzerinden Ollama'ya erişir:

```bash
az webapp config appsettings set \
  --name helpdesk-bot-klimasan \
  --resource-group rg-helpdesk-bot \
  --settings OLLAMA_BASE_URL="http://192.168.1.50:11434"
```

---

## Yöntem 4: Bot'u On-Prem Çalıştır (En Basit)

VPN'e hiç gerek kalmaz. Bot zaten Ollama ve ManageEngine ile aynı ağda olur.

```
Kullanıcı (Teams)
    │
    ▼
Microsoft Teams Service
    │
    ▼
Azure Bot Service (sadece Channel Registration — ücretsiz)
    │
    ▼ (messaging endpoint)
ngrok / Cloudflare Tunnel → On-prem sunucu (Node.js bot + Ollama)
```

### Kurulum

1. Azure'da sadece **Bot Channels Registration** oluşturun (ücretsiz)
2. On-prem sunucuda:
   ```bash
   npm install && npm run build && npm start
   ```
3. Dış erişim için Cloudflare Tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:3978
   ```
4. Azure Bot → Messaging endpoint: `https://xxx.cfargotunnel.com/api/messages`

### Avantajları
- Ollama ve ManageEngine'e doğrudan localhost/LAN erişimi
- Azure maliyeti $0 (sadece Bot Registration, ücretsiz)
- VPN/tunnel sadece bot endpoint'i için gerekli

### Dezavantajları
- Sunucunun 7/24 açık kalması lazım
- Tunnel koptuğunda bot erişilemez olur (PM2 + cloudflared service ile çözülür)

---

## Hangisini Seçmeliyim?

```
Hızlıca test etmek istiyorum
  └─► Yöntem 2 (Cloudflare Tunnel) veya Yöntem 4 (on-prem)

Production, App Service kullanacağım, basit olsun
  └─► Yöntem 1 (Hybrid Connection) ✅ TAVSİYE

Production, kurumsal IT politikası var, tüm Azure ↔ on-prem trafiği VPN üzerinden olmalı
  └─► Yöntem 3 (VPN Gateway)

Azure maliyeti minimum olsun
  └─► Yöntem 4 (on-prem bot + tunnel)
```
