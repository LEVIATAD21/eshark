# 🚀 eShark — Deploy em Produção

## Stack
- **Frontend:** PWA vanilla (HTML/CSS/JS) — zero dependências
- **Backend:** Firebase (Firestore + Auth + Functions + Hosting)
- **Distribuição:** PWA + APK (gerado pelo PWABuilder)

---

## 1) Deploy do site (Hosting)

### Opção A — Vercel (mais simples)
```bash
# Suba o conteúdo da pasta eshark/ para um repo no GitHub
git init && git add . && git commit -m "init"
git remote add origin https://github.com/SEU_USER/eshark.git
git push -u origin main
```
Vá em https://vercel.com/new → importe o repo → **Deploy**.

### Opção B — Netlify
- Arraste a pasta no painel da Netlify
- Ou conecte o repo do GitHub

### Opção C — Firebase Hosting (recomendado se for usar Firestore)
```bash
npm i -g firebase-tools
firebase login
firebase init hosting   # selecione o projeto, pasta = .
cp backend/firebase.json .
firebase deploy --only hosting
```

---

## 2) Backend Firebase

### 2.1) Criar projeto
- https://console.firebase.google.com → **Novo projeto** "eshark-prod"
- Ative: **Authentication** (Google + Email), **Firestore** (modo produção), **Functions** (plano Blaze — gratuito até cota)

### 2.2) Deploy das regras
```bash
cd backend
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 2.3) Deploy das functions (opcional na fase 1)
```bash
firebase init functions    # JS, install deps yes
cp cloud-functions.example.js functions/index.js
cd functions && npm i firebase-admin firebase-functions
firebase deploy --only functions
```

### 2.4) Conectar o frontend
Adicione no `index.html` antes de `</body>` (apenas em produção):
```html
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

  const app = initializeApp({
    apiKey: "...",
    authDomain: "eshark-prod.firebaseapp.com",
    projectId: "eshark-prod",
    storageBucket: "eshark-prod.appspot.com",
    messagingSenderId: "...",
    appId: "..."
  });
  window.fbAuth = getAuth(app);
  window.fbDB = getFirestore(app);
  window.fbGoogleProvider = new GoogleAuthProvider();
</script>
```
**E atualize a CSP** no `index.html` adicionando `https://www.gstatic.com https://*.googleapis.com` em `script-src` e `connect-src`.

Substitua o mock `loginGoogle()` em `js/app.js` por:
```js
async function loginGoogle() {
  const { user } = await signInWithPopup(window.fbAuth, window.fbGoogleProvider);
  State.user = { uid: user.uid, name: user.displayName, email: user.email };
  await Store.setUser(State.user);
  enterApp();
}
```

---

## 3) Configurar IDs de afiliado

Edite `js/data.js` → objeto `AFF`:
```js
const AFF = {
  shopee: (slug) => `https://shopee.com.br/${slug}?af_id=SEU_ID_REAL`,
  ml:     (slug) => `https://www.mercadolivre.com.br/${slug}?matt_tool=SEU_TOOL&matt_word=SEU_WORD`,
  amazon: (slug) => `https://www.amazon.com.br/${slug}?tag=SEU-AMAZON-TAG-20`
};
```

> **Importante:** cadastre-se em **Programa de Afiliados Shopee**, **Mercado Livre Afiliados** e **Amazon Associados** para obter seus IDs.

---

## 4) Gerar APK

1. **Suba o PWA** (passo 1)
2. Verifique se o manifest está OK em https://manifest-validator.appspot.com
3. Acesse https://www.pwabuilder.com → cole sua URL
4. Aba **Android** → **Package for Stores** → escolha:
   - **Signed APK** (pra distribuir direto, fora da Play Store)
   - **App Bundle** (pra submeter na Play Store)
5. Download → instale no celular

### Distribuição
- **WhatsApp/Telegram**: mande o `.apk` direto
- **Site**: hospede com link "Baixar APK"
- **Play Store**: precisa de conta dev ($25 vitalício)

---

## 5) Marketing e tráfego (validação fase 2)

### Conteúdo viral (TikTok/Instagram)
1. Grave vídeo de 15s mostrando uma oferta brutal no app
2. CTA: "Link no perfil — economiza R$ X"
3. Use hashtags: `#achadinhosshopee #ofertasdodia #promocao`

### Grupos
- WhatsApp/Telegram: poste 1 achadinho/dia com seu link

### SEO (médio prazo)
- Crie blog em `/blog` com posts "Top 10 fones Bluetooth baratos"
- Cada post linka pros produtos no eShark

---

## 6) Métricas (Google Analytics 4)

Adicione no `index.html` antes de `</head>`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXX', { anonymize_ip: true });
</script>
```

E no `js/app.js → goAffiliate`:
```js
try { gtag('event', 'affiliate_click', { product_id: product.id, platform: offer.platform, price: offer.price }); } catch(_) {}
```

E na CSP, libere o domínio do GA.

---

## Checklist de lançamento

- [ ] Site publicado e acessível por HTTPS
- [ ] manifest.json válido (PWABuilder mostra ✅)
- [ ] Service Worker registrado (DevTools → Application)
- [ ] Login funcionando (real Firebase Auth)
- [ ] Pelo menos 20 produtos no Firestore
- [ ] IDs de afiliado nos URLs (testar 1 link real)
- [ ] Página /termos e /privacidade publicadas
- [ ] GA4 configurado
- [ ] APK gerado e testado em 1 celular Android
- [ ] Primeiro post no TikTok no ar
