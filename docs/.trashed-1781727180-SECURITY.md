# 🛡️ eShark — Modelo de Segurança

## Premissa

> "Cliente é território hostil." Nada que vem do navegador é confiável.
> A defesa **real** está nas regras do Firestore e nas Cloud Functions.

O frontend implementa **defense in depth** — várias camadas que tornam o ataque
**caro** para o agressor casual, mesmo sabendo que um atacante determinado
sempre consegue ler/modificar JS no cliente.

---

## Superfícies de ataque mapeadas

### 1) XSS via campos de produto / busca / reviews
**Defesa:**
- `Sec.escapeHTML` em **toda** interpolação de string
- CSP estrito (sem `unsafe-eval`, scripts somente self)
- Nenhum `innerHTML` recebe valor direto sem `E(...)`

### 2) Open Redirect via link afiliado falso
**Defesa:**
- `Sec.isAllowedAffiliate(url)` valida protocolo `https:` + hostname em whitelist
- Whitelist atual: `shopee.com.br`, `mercadolivre.com.br`, `mercadolibre.com`,
  `amazon.com.br`, `amzn.to`, `magazineluiza.com.br`, `aliexpress.com`
- Links com `rel="noopener noreferrer nofollow"`

### 3) localStorage tampering (usuário editando dados)
**Defesa:**
- Toda gravação assinada: `payload + sig` com `SHA-256(payload + sessionId)`
- Leitura recalcula e compara — divergência → **dado descartado**
- `sessionId` é regenerado em ataques detectados (tamperFlag)

### 4) CSRF / Replay em endpoints (quando plugar Firebase Functions)
**Defesa:**
- Firebase callable functions exigem `context.auth` válido
- `sessionId` enviado no payload e logado pra correlação
- Cloud Function `logClick` deduplica clicks em janela de 10s

### 5) Clickjacking
**Defesa:**
- Frame buster JS (top !== self → redireciona)
- Header `X-Frame-Options: DENY` (firebase.json)
- CSP `frame-ancestors 'none'`

### 6) Abuso de API (rate exhausting)
**Defesa client:**
- Token bucket por ação:
  - `nav`: 30 por 5s
  - `auth`: 5 por 30s
  - `buy`: 12 por 10s

**Defesa server (Cloud Functions):**
- Counter atômico `/rate/{uid}` em transação
- Máximo 60 writes/minuto por usuário

### 7) Conta hijack via senha fraca
**Defesa:**
- Validação client: mín 8 caracteres, sem espaços, máx 64
- Em produção: Firebase Auth + email verification
- Permitir 2FA opcional

### 8) Console/DevTools social-engineering
**Defesa:**
- Banner em console: "Não cole código aqui" (estilo Facebook/Google)
- Soft devtools-detect só em localhost (avisa, não bloqueia)

### 9) Vazamento de dados
**Defesa:**
- Política de **mínimo necessário**: não pedimos endereço, CPF, cartão
- Export GDPR-style em 1 clique
- Delete completo (account + subcollections) via Cloud Function

### 10) Supply-chain (dependências comprometidas)
**Defesa:**
- Zero dependências externas no frontend (vanilla JS)
- Nenhum CDN no `<head>` — tudo self-hosted
- CSP `default-src 'self'`

---

## Threat model — o que **não** estamos defendendo

❌ Atacante com acesso físico ao dispositivo do usuário
❌ Engenharia social fora do app (phishing por email/whatsapp)
❌ Malware no celular do usuário
❌ Plataforma parceira hackeada (Shopee/ML)
❌ Servidor Firebase comprometido pela Google

---

## Procedimentos de incidente

1. **Tamper detectado em sessão** → `Sec.flagTamper(reason)` → sessão limpa + reload
2. **Rate-limit estourado** → toast pro usuário, log no server (Cloud Function)
3. **Login suspeito** (5 tentativas em 30s) → bloqueio temporário + email opcional

---

## Auditoria

- Cada `click` afiliado registra: `uid, productId, platform, price, shipping, ts, ip, ua, sessionId`
- Logs no Firestore podem ser exportados pro BigQuery pra análise antifraude
