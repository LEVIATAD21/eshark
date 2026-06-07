# 🦈 eShark — Central Inteligente de Ofertas

PWA agregador afiliado com **engine de decisão automática da melhor oferta** entre Shopee, Mercado Livre e Amazon.

---

## ⚡ Quick Start (3 minutos)

### 1) Rodar localmente
```bash
cd eshark
python3 -m http.server 8080
```
Abra `http://localhost:8080` no celular ou Chrome (dev tools → device mode).

### 2) Publicar na Vercel/Netlify
- Crie um repositório no GitHub e suba a pasta `eshark/`
- Vercel: `New Project → Import → Deploy` (zero config)
- Netlify: arraste a pasta no painel

### 3) Gerar o APK (PWABuilder)
1. Publique o site (passo 2)
2. Vá em https://www.pwabuilder.com
3. Cole a URL → **Package for Stores** → Android → baixe `.apk`

---

## 📁 Estrutura

```
eshark/
├── index.html              # Shell do app (todas as telas)
├── manifest.json           # PWA manifest
├── service-worker.js       # Cache offline
├── css/
│   └── style.css           # Design system completo
├── js/
│   ├── security.js         # Camada de segurança (XSS, tamper, rate-limit, signed storage)
│   ├── data.js             # Produtos mockados + categorias
│   ├── decision.js         # 🧠 ENGINE DE MELHOR OFERTA
│   ├── store.js            # Persistência local segura
│   ├── ui.js               # Renderização (templates)
│   └── app.js              # Controller + eventos + rotas
├── icons/                  # Ícones PWA + screenshots
├── backend/
│   ├── firestore.rules     # 🔒 Regras Firebase (default-deny)
│   ├── firebase.json       # Config hosting + headers
│   ├── firestore.indexes.json
│   └── cloud-functions.example.js   # Server-side anti-fraude
└── docs/
    ├── README.md           # Este arquivo
    ├── SECURITY.md         # Modelo de ameaças
    └── DEPLOY.md           # Passo-a-passo de produção
```

---

## 🧠 Engine de Decisão (o coração do app)

Para cada produto com múltiplas ofertas, calcula:

```
score = w_preco·n(custo_total) + w_ship·n(frete) + w_prazo·n(prazo) + w_rep·n(1-reputacao)
        − bônus(perks)   // frete grátis, full, prime, oficial, cupom, parcelado
        + penalidades    // vendedor com nota < 4.3
```

**Modos** (config no Perfil):
- `balanced` (default): 50/15/20/15
- `cheap`: 70/10/10/10
- `fast`: 20/10/55/15
- `trust`: 30/10/20/40

A oferta com menor score vence e ganha o destaque "✨ Melhor escolha" + explicação humanizada
("Recomendado por: frete grátis, entrega rápida, menor preço total.").

---

## 🔐 Segurança em camadas

### Frontend (defense in depth)
- ✅ **CSP estrito** com `default-src 'self'` + whitelist
- ✅ **HTML escape** em **toda** string renderizada (`Sec.escapeHTML`)
- ✅ **URL whitelist** para redirects afiliados (apenas Shopee/ML/Amazon/Magalu/AliExpress)
- ✅ **Signed localStorage**: cada valor é gravado com HMAC-SHA256 da sessão — tampering invalida o dado
- ✅ **Rate-limit token bucket** por ação (nav, auth, buy)
- ✅ **Validação de inputs** (email, senha, query, productId, qty)
- ✅ **Frame buster** anti-clickjacking
- ✅ **Permissions-Policy** zera geo/mic/câmera
- ✅ **DevTools soft-detect** em localhost (avisa o user)
- ✅ **Anti-tamper** com Object.freeze em estruturas críticas

### Backend (Firestore Rules)
- ✅ **Default DENY** — nada lê/escreve sem regra explícita
- ✅ **Schema enforcement** (`keys().hasOnly`, tipos, tamanhos, ranges)
- ✅ **Imutabilidade** de campos críticos (uid, createdAt, ts)
- ✅ **Rate-limit server-side** via doc `/rate/{uid}` + Cloud Function transação
- ✅ **Anti-duplicate** clicks (10s window)
- ✅ **Logs de IP/UA** para auditoria

### Cabeçalhos HTTP (firebase.json)
- HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy

---

## ⚖️ Compliance afiliado

✅ Origem da oferta **sempre exibida** (badge da plataforma)
✅ Aviso de redirecionamento antes do clique
✅ Página "Sobre afiliados" explicando o modelo
✅ Links com `rel="noopener noreferrer nofollow"` + `target="_blank"`
❌ Nunca processa pagamento
❌ Nunca esconde origem

---

## 🚀 Próximos passos

1. **Plugar Firebase Auth real** em `js/app.js` (substituir mocks `loginGoogle`/`loginEmail`)
2. **Plugar Firestore** em `js/data.js` (substituir array `PRODUCTS` por `getDocs`)
3. **Plugar afiliado real** em `js/data.js` (substituir `AFF.shopee/ml/amazon` pelos seus IDs)
4. **Push notifications** via Firebase Cloud Messaging (esqueleto já em `service-worker.js`)
5. **Cron de coleta de preços** via Cloud Functions (esqueleto em `cloud-functions.example.js`)

---

## 📊 Métricas pra acompanhar

| Métrica | Onde | Como |
|---|---|---|
| CTR (cliques/views) | GA4 + custom event `affiliate_click` | dispare no `goAffiliate` |
| Taxa de conversão | Painel da Shopee/ML | comparar cliques × comissões |
| Produto mais clicado | Firestore aggregate | groupBy(productId) |
| Modo de decisão usado | Firestore user prefs | telemetria opcional |

---

Feito com 🦈 pelo time eShark.
