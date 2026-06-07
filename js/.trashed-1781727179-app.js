/* eShark — Application controller
 * Routing, state, events, security checks at the controller level.
 */
(function () {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const State = {
    user: null,
    favorites: [],
    clicks: [],
    prefs: { notif: true, dark: true, sound: false, mode: 'balanced' },
    mode: 'balanced',
    view: 'home',
    history: [],         // navigation stack
    searchQuery: '',
    searchFilter: 'all',
    searchCategory: null,
    currentProductId: null
  };

  // ---------- AUDIO TICK ----------
  function tick() {
    if (!State.prefs.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.04;
      o.start(); o.stop(ctx.currentTime + 0.05);
      setTimeout(() => ctx.close(), 100);
    } catch (_) {}
  }

  // ---------- ROUTING ----------
  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  }
  function hideScreens() { $$('.screen').forEach(s => s.classList.remove('active')); }

  function showApp() {
    hideScreens();
    $('#app').hidden = false;
  }

  function setView(name, opts = {}) {
    if (!Sec.rateLimit('nav', 30, 5000)) { UI.toast('Calma aí — muitas ações rápidas.'); return; }
    if (State.view !== name) State.history.push(State.view);
    State.view = name;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name && ['home','search','favorites','orders','profile'].includes(name)));
    const back = $('#btnBack');
    back.hidden = ['home','search','favorites','orders','profile'].includes(name);
    // search visibility
    $('#searchInput').value = name === 'search' ? State.searchQuery : '';

    // render
    if (name === 'home') UI.renderHome(State);
    else if (name === 'search') UI.renderSearch(State);
    else if (name === 'product') UI.renderProduct(opts.productId || State.currentProductId, State);
    else if (name === 'checkout') UI.renderCheckout(opts.productId || State.currentProductId, State);
    else if (name === 'favorites') UI.renderFavorites(State);
    else if (name === 'orders') UI.renderOrders(State);
    else if (name === 'profile') UI.renderProfile(State);
    else if (name === 'static') UI.renderStatic(opts.slug);

    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    tick();
  }

  function goBack() {
    const prev = State.history.pop() || 'home';
    setView(prev);
  }

  // ---------- AUTH (mock — substituir por Firebase Auth) ----------
  async function loginGoogle() {
    if (!Sec.rateLimit('auth', 5, 30000)) { UI.toast('Espere um pouco antes de tentar de novo.'); return; }
    // Mock — em produção: signInWithPopup(auth, GoogleProvider)
    State.user = { name: 'Usuário Teste', email: 'voce@gmail.com', provider: 'google' };
    await Store.setUser(State.user);
    UI.toast('Bem-vindo, ' + State.user.name + '!');
    enterApp();
  }

  async function loginEmail() {
    const email = $('#emailInput').value.trim();
    const pass = $('#passInput').value;
    const hint = $('#emailHint');
    hint.textContent = '';
    if (!Sec.Validate.email(email)) { hint.textContent = 'Email inválido.'; return; }
    if (!Sec.Validate.password(pass)) { hint.textContent = 'Senha precisa ter 8+ caracteres, sem espaços.'; return; }
    if (!Sec.rateLimit('auth', 5, 30000)) { hint.textContent = 'Muitas tentativas. Espere.'; return; }
    // Mock — em produção: createUserWithEmailAndPassword + verifyEmail
    State.user = { name: email.split('@')[0], email, provider: 'email' };
    await Store.setUser(State.user);
    UI.toast('Logado com sucesso!');
    enterApp();
  }

  async function logout() {
    const ok = await UI.modal({ title: 'Sair?', body: 'Você precisará entrar novamente.', ok: 'Sair' });
    if (!ok) return;
    await Store.logout();
    State.user = null;
    UI.renderProfile(State);
    UI.toast('Sessão encerrada.');
  }

  function enterApp() {
    showApp();
    setView('home');
  }

  // ---------- ENTRY FLOW ----------
  async function bootEntry() {
    const seen = await Store.hasSeenOnboarding();
    const user = await Store.getUser();
    State.user = user;
    State.favorites = await Store.getFavorites();
    State.clicks    = await Store.getClicks();
    State.prefs     = await Store.getPrefs();
    State.mode      = State.prefs.mode || 'balanced';

    setTimeout(() => {
      if (!seen) showScreen('onboarding');
      else if (!user) showScreen('login');
      else enterApp();
    }, 1400); // splash min duration
  }

  // ---------- ONBOARDING ----------
  let onbIdx = 0;
  function setOnbSlide(i) {
    onbIdx = Math.max(0, Math.min(2, i));
    $$('#onbSlides .onb-slide').forEach((s,j) => s.classList.toggle('active', j === onbIdx));
    $$('#onbDots .dot').forEach((d,j) => d.classList.toggle('active', j === onbIdx));
    $('#onbNext').textContent = onbIdx === 2 ? 'Começar' : 'Continuar';
  }

  async function finishOnboarding() {
    await Store.markOnboardingSeen();
    if (State.user) enterApp();
    else showScreen('login');
  }

  // ---------- AFFILIATE REDIRECT ----------
  async function goAffiliate(productId, platform) {
    if (!Sec.Validate.productId(productId)) return;
    if (!Sec.rateLimit('buy', 12, 10000)) { UI.toast('Muitos cliques de compra. Aguarde.'); return; }

    const product = Data.getById(productId);
    if (!product) return;

    // pick offer based on chosen platform or best
    let offer;
    if (platform) offer = product.offers.find(o => o.platform === platform);
    if (!offer) offer = Decision.evaluate(product, { mode: State.mode }).best.offer;
    if (!offer) return;

    if (!Sec.isAllowedAffiliate(offer.url)) {
      UI.toast('🚫 Link bloqueado por segurança.');
      return;
    }

    // Show redirect overlay
    const ov = $('#redirectOverlay');
    $('#redirTarget').textContent = `${Data.platformLabel(offer.platform)} — ${UI.fmtBRL(offer.price)}`;
    ov.hidden = false;

    // Log click (signed local store)
    await Store.logClick({
      productId: product.id,
      platform: offer.platform,
      url: offer.url,
      price: offer.price
    });
    State.clicks = await Store.getClicks();

    let cancelled = false;
    $('#redirCancel').onclick = () => { cancelled = true; ov.hidden = true; UI.toast('Compra cancelada.'); };

    setTimeout(() => {
      if (cancelled) return;
      ov.hidden = true;
      // Open in new tab — preserves app context
      const w = window.open(offer.url, '_blank', 'noopener,noreferrer');
      if (!w) UI.toast('Permita pop-ups pra abrir o parceiro.');
    }, 1400);
  }

  // ---------- EVENT BINDINGS ----------
  function bindEvents() {

    // Onboarding
    $('#onbNext').addEventListener('click', () => {
      if (onbIdx < 2) setOnbSlide(onbIdx + 1);
      else finishOnboarding();
    });
    $('#onbSkip').addEventListener('click', finishOnboarding);

    // Login
    $('#loginGoogle').addEventListener('click', loginGoogle);
    $('#loginEmail').addEventListener('click', () => {
      $('#emailForm').hidden = !$('#emailForm').hidden;
    });
    $('#emailSubmit').addEventListener('click', loginEmail);
    $('#loginSkip').addEventListener('click', () => { Store.markOnboardingSeen(); enterApp(); });

    // Topbar
    $('#btnBack').addEventListener('click', goBack);
    $('#btnNotif').addEventListener('click', async () => {
      const n = State.favorites.length;
      await UI.modal({ title: '🔔 Notificações', body: n ? `Acompanhando ${n} produto(s). Você será avisado quando o preço cair.` : 'Você ainda não acompanha nenhum produto.', ok: 'OK', cancel: 'Fechar' });
    });

    // Tabs
    $$('.tab').forEach(t => t.addEventListener('click', () => setView(t.dataset.tab)));

    // Search
    const si = $('#searchInput');
    si.addEventListener('focus', () => setView('search'));
    si.addEventListener('input', () => {
      const v = si.value;
      if (!Sec.Validate.search(v)) { si.value = v.slice(0, 80); }
      State.searchQuery = si.value;
      $('#searchClear').hidden = !si.value;
      UI.renderSearch(State);
    });
    $('#searchClear').addEventListener('click', () => {
      si.value = ''; State.searchQuery = ''; $('#searchClear').hidden = true; UI.renderSearch(State);
    });

    // Filter chips
    document.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (chip) {
        $$('.chip').forEach(c => c.classList.toggle('active', c === chip));
        State.searchFilter = chip.dataset.filter;
        UI.renderSearch(State);
      }
    });

    // Click delegation for cards / categories / suggestions / fav buttons
    document.addEventListener('click', async e => {
      // fav toggle (button has stopPropagation needs)
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        e.preventDefault(); e.stopPropagation();
        const id = favBtn.dataset.fav;
        const isNow = await Store.toggleFavorite(id);
        State.favorites = await Store.getFavorites();
        UI.toast(isNow ? '❤️ Adicionado aos favoritos' : 'Removido dos favoritos');
        // re-render relevant view
        if (State.view === 'home') UI.renderHome(State);
        else if (State.view === 'search') UI.renderSearch(State);
        else if (State.view === 'favorites') UI.renderFavorites(State);
        else if (State.view === 'product') UI.renderProduct(State.currentProductId, State);
        return;
      }

      // category
      const cat = e.target.closest('[data-cat]');
      if (cat) {
        State.searchCategory = cat.dataset.cat;
        State.searchQuery = '';
        setView('search');
        return;
      }

      // suggestion
      const sg = e.target.closest('.sg-item');
      if (sg && sg.dataset.pid) {
        State.currentProductId = sg.dataset.pid;
        setView('product', { productId: sg.dataset.pid });
        return;
      }

      // product card
      const pid = e.target.closest('[data-pid]');
      if (pid && pid.dataset.pid) {
        State.currentProductId = pid.dataset.pid;
        const action = pid.dataset.action;
        if (action === 'reopen') { setView('product', { productId: pid.dataset.pid }); return; }
        // checkout button?
        if (pid.id === 'pBuy') { setView('checkout', { productId: pid.dataset.pid }); return; }
        if (pid.id === 'coGo') { goAffiliate(pid.dataset.pid, pid.dataset.platform); return; }
        // default — open product
        if (!pid.classList.contains('btn-buy')) setView('product', { productId: pid.dataset.pid });
        return;
      }

      // checkout option
      const opt = e.target.closest('.co-opt');
      if (opt) {
        $$('.co-opt').forEach(o => o.classList.toggle('active', o === opt));
        const platform = opt.dataset.platform;
        const product = Data.getById(State.currentProductId);
        const offer = product.offers.find(o => o.platform === platform);
        $('#sumPrice').textContent = UI.fmtBRL(offer.price);
        $('#sumShip').textContent = offer.shipping === 0 ? 'Grátis' : UI.fmtBRL(offer.shipping);
        const qty = parseInt($('#qtyVal').textContent, 10) || 1;
        $('#sumTotal').textContent = UI.fmtBRL(offer.price * qty + offer.shipping);
        $('#coGo').dataset.platform = platform;
        $('#coGo').textContent = `Continuar para ${Data.platformLabel(platform)} →`;
        return;
      }

      // qty
      if (e.target.id === 'qtyMinus' || e.target.id === 'qtyPlus') {
        const span = $('#qtyVal');
        let q = parseInt(span.textContent, 10) || 1;
        q = e.target.id === 'qtyMinus' ? Math.max(1, q - 1) : Math.min(50, q + 1);
        span.textContent = q;
        $('#sumQty').textContent = q;
        const platform = $('.co-opt.active').dataset.platform;
        const product = Data.getById(State.currentProductId);
        const offer = product.offers.find(o => o.platform === platform);
        $('#sumTotal').textContent = UI.fmtBRL(offer.price * q + offer.shipping);
        return;
      }

      // alert price
      if (e.target.id === 'pAlert') {
        UI.toast('🔔 Você será avisado se o preço cair.');
        return;
      }

      // share
      if (e.target.id === 'pShare') {
        const p = Data.getById(State.currentProductId);
        if (navigator.share) {
          try { await navigator.share({ title: p.name, text: 'Olha essa oferta no eShark!', url: location.href }); } catch (_) {}
        } else {
          try { await navigator.clipboard.writeText(location.href); UI.toast('🔗 Link copiado!'); } catch (_) { UI.toast('Não foi possível copiar.'); }
        }
        return;
      }

      // static page links
      const route = e.target.closest('[data-route]');
      if (route) {
        e.preventDefault();
        setView('static', { slug: route.dataset.route });
        return;
      }
    });

    // Profile prefs
    $('#prefNotif').addEventListener('change', async (e) => { State.prefs.notif = e.target.checked; await Store.setPref('notif', e.target.checked); UI.toast(e.target.checked ? 'Notificações ativadas' : 'Notificações desativadas'); });
    $('#prefDark').addEventListener('change', async (e) => { State.prefs.dark = e.target.checked; await Store.setPref('dark', e.target.checked); document.documentElement.classList.toggle('light', !e.target.checked); });
    $('#prefSound').addEventListener('change', async (e) => { State.prefs.sound = e.target.checked; await Store.setPref('sound', e.target.checked); tick(); });
    $('#prefMode').addEventListener('change', async (e) => {
      State.prefs.mode = e.target.value;
      State.mode = e.target.value;
      await Store.setPref('mode', e.target.value);
      UI.toast('Modo de decisão: ' + e.target.options[e.target.selectedIndex].text);
      UI.renderHome(State);
    });

    // Profile actions
    $('#btnExport').addEventListener('click', async () => {
      const data = await Store.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'eshark-meus-dados.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      UI.toast('📥 Dados exportados.');
    });
    $('#btnClear').addEventListener('click', async () => {
      const ok = await UI.modal({ title: 'Limpar histórico?', body: 'Cliques e favoritos serão apagados deste dispositivo.', ok: 'Limpar tudo' });
      if (!ok) return;
      await Store.clearAll();
      State.favorites = []; State.clicks = [];
      UI.renderProfile(State);
      UI.toast('🧹 Histórico limpo.');
    });
    $('#btnLogout').addEventListener('click', logout);

    // Hardware back (Android)
    window.addEventListener('popstate', () => goBack());
  }

  // ---------- SERVICE WORKER ----------
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  // ---------- BOOT ----------
  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    UI.startFlashTimer();
    registerSW();
    setOnbSlide(0);
    await bootEntry();
  });
})();
