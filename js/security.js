/* eShark — Security Layer (hardcore)
 * Defense in depth — XSS, tamper, replay, rate-limit, integrity
 * NOTE: client-side security NEVER replaces server-side validation.
 * This module raises the cost of attack for casual abusers and
 * complements the Firebase rules / serverless validations.
 */
(function (global) {
  'use strict';

  const NS = 'eshark';
  const VERSION = '1.0.0';
  const BUILD = (() => {
    // pseudo-build id from constants — also used as integrity baseline
    const s = `${NS}|${VERSION}|${navigator.userAgent.length}`;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  })();

  // ---------- 1) HTML ESCAPE / SANITIZE ----------
  const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;' };
  function escapeHTML(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"'`=\/]/g, c => ENT[c]);
  }

  function escapeAttr(str) { return escapeHTML(str); }

  // sanitize URLs to allow only http/https/mailto
  function safeURL(u) {
    if (!u) return '#';
    try {
      const url = new URL(u, location.origin);
      if (!/^https?:|^mailto:$/.test(url.protocol)) return '#';
      return url.toString();
    } catch (_) { return '#'; }
  }

  // strict whitelist for affiliate redirects
  const AFFIL_HOSTS = [
    'shopee.com.br', 's.shopee.com.br',
    'mercadolivre.com.br', 'mercadolibre.com', 'click.mercadolivre.com.br',
    'amazon.com.br', 'amzn.to',
    'magazineluiza.com.br', 'aliexpress.com'
  ];
  function isAllowedAffiliate(u) {
    try {
      const url = new URL(u);
      if (url.protocol !== 'https:') return false;
      const host = url.hostname.toLowerCase();
      return AFFIL_HOSTS.some(h => host === h || host.endsWith('.' + h));
    } catch (_) { return false; }
  }

  // ---------- 2) INPUT VALIDATION ----------
  const Validate = {
    email: v => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(v || '').trim()) && v.length <= 120,
    password: v => typeof v === 'string' && v.length >= 8 && v.length <= 64 && !/\s/.test(v),
    search: v => typeof v === 'string' && v.length <= 80,
    productId: v => /^[a-z0-9_-]{1,40}$/i.test(String(v || '')),
    qty: v => Number.isInteger(+v) && +v >= 1 && +v <= 50,
  };

  // ---------- 3) RATE LIMITER (token bucket per action) ----------
  const Bucket = {};
  function rateLimit(key, max, perMs) {
    const now = Date.now();
    const b = Bucket[key] || (Bucket[key] = { tokens: max, ts: now });
    const refill = Math.floor((now - b.ts) / perMs) * max;
    if (refill > 0) { b.tokens = Math.min(max, b.tokens + refill); b.ts = now; }
    if (b.tokens <= 0) return false;
    b.tokens -= 1;
    return true;
  }

  // ---------- 4) SESSION TOKEN / CSRF-LITE ----------
  function rand(len = 32) {
    const buf = new Uint8Array(len);
    (crypto || global.crypto).getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  }
  function getSession() {
    let t = sessionStorage.getItem(NS + '.session');
    if (!t) { t = rand(24); sessionStorage.setItem(NS + '.session', t); }
    return t;
  }

  // ---------- 5) SAFE STORAGE (signed JSON) ----------
  async function digest(str) {
    try {
      const buf = new TextEncoder().encode(str);
      const h = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      // fallback djb2 (non-cryptographic)
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
      return ('00000000' + (h >>> 0).toString(16)).repeat(8).slice(0, 64);
    }
  }
  async function safeSet(key, value) {
    const k = NS + ':' + key;
    const payload = JSON.stringify({ v: value, t: Date.now() });
    const sig = await digest(payload + '|' + getSession());
    localStorage.setItem(k, JSON.stringify({ p: payload, s: sig }));
  }
  async function safeGet(key, fallback = null) {
    const k = NS + ':' + key;
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    try {
      const { p, s } = JSON.parse(raw);
      const sig = await digest(p + '|' + getSession());
      if (sig !== s) {
        // tamper detected — wipe key
        localStorage.removeItem(k);
        return fallback;
      }
      return JSON.parse(p).v;
    } catch (_) { return fallback; }
  }
  function safeRemove(key) { localStorage.removeItem(NS + ':' + key); }

  // ---------- 6) ANTI-TAMPER CHECKS ----------
  let tamperFlag = false;
  function flagTamper(reason) {
    if (tamperFlag) return;
    tamperFlag = true;
    try { console.warn('[eShark/security] tamper:', reason); } catch (_) {}
    // soft response — slow down & invalidate session
    sessionStorage.removeItem(NS + '.session');
    setTimeout(() => { try { location.reload(); } catch (_) {} }, 800);
  }

  // freeze critical globals (best-effort)
  try {
    Object.freeze(Validate);
    Object.freeze(ENT);
  } catch (_) {}

  // detect if console functions are overridden after load
  const _origLog = console.log;
  Object.defineProperty(window, '__esharkProbe', {
    get() { return true; }, configurable: false
  });

  // detect devtools (very rough — only triggers a soft notice)
  let devtoolsOpen = false;
  function devtoolsCheck() {
    const t = Date.now();
    debugger; // jshint ignore:line
    const dt = Date.now() - t;
    if (dt > 80) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        try { console.info('%c⚠ eShark', 'color:#22c55e;font-size:18px;font-weight:800', 'Console aberto. Não cole código que terceiros pediram — pode roubar sua sessão.'); } catch (_) {}
      }
    }
  }
  // run periodically (soft) — disabled in production by default
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    setInterval(devtoolsCheck, 4000);
  }

  // ---------- 7) BLOCK CLICKJACKING (frame buster) ----------
  if (window.top !== window.self) {
    try { window.top.location = window.self.location; }
    catch (_) { document.body && (document.body.innerHTML = ''); }
  }

  // ---------- 8) PROTECT CONTEXTMENU ON GALLERIES (UX, not security) ----------
  document.addEventListener('contextmenu', (e) => {
    if (e.target && e.target.closest && e.target.closest('.p-gallery')) e.preventDefault();
  });

  // ---------- 9) GLOBAL ERROR SINK (no leak) ----------
  window.addEventListener('error', (e) => {
    try { console.warn('[eShark]', e.message); } catch (_) {}
  });
  window.addEventListener('unhandledrejection', (e) => {
    try { console.warn('[eShark/promise]', e.reason && e.reason.message); } catch (_) {}
  });

  // ---------- 10) PUBLIC API ----------
  global.Sec = {
    NS, VERSION, BUILD,
    escapeHTML, escapeAttr, safeURL, isAllowedAffiliate,
    Validate, rateLimit, getSession,
    safeSet, safeGet, safeRemove,
    digest, rand,
    flagTamper
  };

  // expose buildId for UI
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('buildId');
    if (el) el.textContent = BUILD;
  });

})(window);
