/* eShark — UI rendering layer
 * All DOM building uses Sec.escapeHTML for any user-derived string.
 * Templates are pure functions of state.
 */
(function (global) {
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const E  = Sec.escapeHTML;

  function fmtBRL(n) {
    return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(n) { return Math.round(n) + '%'; }

  // ---------- CARD (horizontal, used in home + grid) ----------
  function cardHTML(product, opts = {}) {
    const dec = Decision.evaluate(product, { mode: opts.mode || 'balanced' });
    const best = dec.best ? dec.best.offer : product.offers[0];
    const pct = Decision.discountPct(product, best);
    const isFav = !!opts.fav;
    const top = product.tags && product.tags[0];
    return `
      <article class="card-h" data-pid="${E(product.id)}" role="button" tabindex="0">
        ${top ? `<span class="badge-top">${E(top.toUpperCase())}</span>` : ''}
        <button class="fav ${isFav ? 'active' : ''}" data-fav="${E(product.id)}" aria-label="Favoritar" type="button">${isFav ? '❤️' : '🤍'}</button>
        <div class="img">${E(product.icon)}</div>
        <p class="name">${E(product.name)}</p>
        <div>
          ${product.oldPrice ? `<span class="old">${fmtBRL(product.oldPrice)}</span>` : ''}
          <span class="price">${fmtBRL(best.price)}</span>
          ${pct > 0 ? `<span class="pct">-${pct}%</span>` : ''}
        </div>
        <div class="src">★ ${E(String(product.reviews))} · ${E(String(product.sold))} vendidos</div>
      </article>`;
  }

  // ---------- HOME ----------
  function renderHome(state) {
    const all = Data.PRODUCTS;
    const hot = all.slice().sort((a,b) => Decision.discountPct(b, b.offers[0]) - Decision.discountPct(a, a.offers[0])).slice(0, 8);
    const flash = all.slice().sort(() => Math.random() - 0.5).slice(0, 6);
    const recommended = all.slice().sort((a,b) => b.sold - a.sold).slice(0, 6);

    const favs = state.favorites || [];

    $('#hotDeals').innerHTML = hot.map(p => cardHTML(p, { mode: state.mode, fav: favs.includes(p.id) })).join('');
    $('#flashDeals').innerHTML = flash.map(p => cardHTML(p, { mode: state.mode, fav: favs.includes(p.id) })).join('');
    $('#recommended').innerHTML = recommended.map(p => cardHTML(p, { mode: state.mode, fav: favs.includes(p.id) })).join('');

    $('#categories').innerHTML = Data.CATEGORIES.map(c => `
      <button class="cat" data-cat="${E(c.id)}" type="button">
        <div class="ic">${E(c.icon)}</div>
        <div class="nm">${E(c.name)}</div>
      </button>`).join('');
  }

  // ---------- SEARCH ----------
  function renderSearch(state) {
    const q = state.searchQuery || '';
    const filter = state.searchFilter || 'all';
    let list = Data.search(q, { category: state.searchCategory });

    // filter
    list = list.map(p => {
      const dec = Decision.evaluate(p, { mode: state.mode });
      return { p, best: dec.best };
    });

    if (filter === 'cheapest') list.sort((a,b) => Decision.totalCost(a.best.offer) - Decision.totalCost(b.best.offer));
    if (filter === 'fast')     list = list.filter(x => x.best.offer.daysToDeliver <= 4).sort((a,b) => a.best.offer.daysToDeliver - b.best.offer.daysToDeliver);
    if (filter === 'rated')    list.sort((a,b) => b.p.reviews - a.p.reviews);
    if (filter === 'freeship') list = list.filter(x => (x.best.offer.shipping === 0));

    const favs = state.favorites || [];
    const meta = $('#resultsMeta');
    if (meta) meta.textContent = list.length ? `${list.length} resultado(s)` : '';

    const empty = $('#searchEmpty');
    const grid = $('#searchResults');
    if (!list.length && q) {
      empty.hidden = false;
      grid.innerHTML = '';
    } else {
      empty.hidden = true;
      grid.innerHTML = list.map(({p}) => cardHTML(p, { mode: state.mode, fav: favs.includes(p.id) })).join('');
    }

    // suggestions
    const sg = $('#suggestions');
    if (q.length >= 1 && q.length < 20) {
      const sugg = Data.PRODUCTS
        .filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 5);
      if (sugg.length) {
        sg.innerHTML = sugg.map(p => `
          <div class="sg-item" data-pid="${E(p.id)}">
            <span>${E(p.icon)}</span>
            <span>${E(p.name)}</span>
          </div>`).join('');
        sg.hidden = false;
      } else { sg.hidden = true; }
    } else { sg.hidden = true; }
  }

  // ---------- PRODUCT ----------
  function renderProduct(productId, state) {
    const p = Data.getById(productId);
    const c = $('#productContainer');
    if (!p) { c.innerHTML = `<p class="empty">Produto não encontrado.</p>`; return; }

    const dec = Decision.evaluate(p, { mode: state.mode });
    const best = dec.best;
    const pct = Decision.discountPct(p, best.offer);
    const savings = Decision.estimatedSavings(p);
    const isFav = (state.favorites || []).includes(p.id);
    const reviews = Data.getReviews(p.id);

    const compareRows = dec.scored.map(s => {
      const o = s.offer;
      const isBest = s === best;
      return `
        <tr class="${isBest ? 'row-best' : ''}">
          <td>${E(Data.platformLabel(o.platform))}</td>
          <td>${fmtBRL(o.price)}</td>
          <td>${o.shipping === 0 ? '<span style="color:#22c55e">Grátis</span>' : fmtBRL(o.shipping)}</td>
          <td>${E(String(o.daysToDeliver))}d</td>
          <td>★ ${E(String(o.sellerRating))}</td>
        </tr>`;
    }).join('');

    const perks = best.badges.map(b => `<span class="perk">${E(b)}</span>`).join('');

    const slidesHTML = (p.images || [p.icon]).map((s,i) => `<div class="slide" data-i="${i}">${E(s)}</div>`).join('');
    const dotsHTML = (p.images || [p.icon]).map((_,i) => `<span class="${i===0?'active':''}"></span>`).join('');

    c.innerHTML = `
      <div class="p-gallery" id="pGallery">
        <div class="glide" id="pGlide" style="width:${(p.images||[p.icon]).length*100}%">${slidesHTML}</div>
        <div class="glide-dots" id="pDots">${dotsHTML}</div>
        <div class="actions-top">
          <button class="pill-btn" id="pShare" type="button" aria-label="Compartilhar">↗</button>
          <button class="pill-btn ${isFav ? 'active' : ''}" id="pFav" data-fav="${E(p.id)}" type="button" aria-label="Favoritar">${isFav ? '❤️' : '🤍'}</button>
        </div>
      </div>

      <h2 class="p-name">${E(p.name)}</h2>
      <div class="p-meta">
        <span class="stars">★ ${E(String(p.reviews))}</span>
        <span>·</span>
        <span>${E(String(p.sold))} vendidos</span>
        ${p.tags && p.tags[0] ? `<span>·</span><span>${E(p.tags[0])}</span>` : ''}
      </div>

      <div class="p-best">
        <h4>✨ Melhor escolha</h4>
        <p class="why">${E(best.reason)} Em <b>${E(Data.platformLabel(best.offer.platform))}</b>.</p>
        <div class="price-line">
          ${p.oldPrice ? `<span class="was">${fmtBRL(p.oldPrice)}</span>` : ''}
          <span class="now">${fmtBRL(best.offer.price)}</span>
          ${pct > 0 ? `<span class="pct">-${pct}% OFF</span>` : ''}
        </div>
        ${best.offer.shipping === 0
          ? `<p class="muted small" style="margin:6px 0 0">+ frete grátis</p>`
          : `<p class="muted small" style="margin:6px 0 0">+ ${fmtBRL(best.offer.shipping)} de frete · entrega em ${best.offer.daysToDeliver}d</p>`}
        <div class="perks">${perks}</div>
      </div>

      <div class="p-cta">
        <button class="btn-buy" id="pBuy" type="button" data-pid="${E(p.id)}">
          🛒 Comprar com melhor oferta · ${fmtBRL(best.offer.price)}
        </button>
        <p class="legal-mini">Você será redirecionado ao site parceiro (${E(Data.platformLabel(best.offer.platform))}) para finalizar com segurança. eShark é um agregador afiliado.</p>
      </div>

      ${savings > 0 ? `<div class="p-urgency">⚡ Você economiza <b>&nbsp;${fmtBRL(savings)}&nbsp;</b> escolhendo essa oferta.</div>` : ''}

      <div class="p-section">
        <h5>📊 Comparação entre lojas</h5>
        <table class="compare">
          <thead><tr><th>Loja</th><th>Preço</th><th>Frete</th><th>Prazo</th><th>Nota</th></tr></thead>
          <tbody>${compareRows}</tbody>
        </table>
      </div>

      <div class="p-section">
        <h5>📝 Descrição</h5>
        <p class="muted" style="line-height:1.5">${E(p.description || 'Sem descrição.')}</p>
      </div>

      <div class="p-section">
        <h5>💬 Avaliações reais</h5>
        <div class="reviews">
          ${reviews.map(r => `
            <div class="review">
              <div><b>${E(r.user)}</b> <span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</span></div>
              <p>${E(r.txt)}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="p-section">
        <h5>🔔 Acompanhe</h5>
        <button class="btn-outline btn-block" id="pAlert" type="button">Avise-me se o preço cair</button>
      </div>
    `;

    // gallery glide
    let idx = 0;
    const total = (p.images || [p.icon]).length;
    const glide = $('#pGlide');
    const dotEls = $$('#pDots span');
    const setIdx = (i) => {
      idx = (i + total) % total;
      glide.style.transform = `translateX(-${(100/total) * idx}%)`;
      dotEls.forEach((d, j) => d.classList.toggle('active', j === idx));
    };
    let startX = 0;
    glide.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    glide.addEventListener('touchend', e => {
      const dx = (e.changedTouches[0].clientX) - startX;
      if (Math.abs(dx) > 40) setIdx(idx + (dx < 0 ? 1 : -1));
    });
    setIdx(0);
  }

  // ---------- CHECKOUT ----------
  function renderCheckout(productId, state) {
    const p = Data.getById(productId);
    const c = $('#checkoutContainer');
    if (!p) { c.innerHTML = `<p class="empty">Produto não encontrado.</p>`; return; }

    const dec = Decision.evaluate(p, { mode: state.mode });
    const best = dec.best.offer;
    const allOffers = dec.scored;

    c.innerHTML = `
      <h3 style="margin:6px 0 12px">🛒 Pré-checkout</h3>

      <div class="co-card">
        <div style="display:flex;gap:12px;align-items:center">
          <div style="font-size:48px">${E(p.icon)}</div>
          <div style="flex:1;min-width:0">
            <p style="margin:0;font-size:14px;line-height:1.3">${E(p.name)}</p>
            <small class="muted">${E(Data.platformLabel(best.platform))} · ★ ${E(String(best.sellerRating))}</small>
          </div>
        </div>
      </div>

      <div class="co-card">
        <h5 style="margin:0 0 10px">Quantidade</h5>
        <div style="display:flex;gap:10px;align-items:center;justify-content:center">
          <button class="icon-btn" id="qtyMinus" type="button">−</button>
          <span id="qtyVal" style="font-size:22px;font-weight:800;min-width:40px;text-align:center">1</span>
          <button class="icon-btn" id="qtyPlus" type="button">+</button>
        </div>
      </div>

      <div class="co-card">
        <h5 style="margin:0 0 10px">Escolha sua prioridade</h5>
        <div class="co-options" id="coOpts">
          ${allOffers.map((s, i) => `
            <button class="co-opt ${i===0 ? 'active' : ''}" data-platform="${E(s.offer.platform)}" type="button">
              <div class="ic">${i===0 ? '⭐' : '🛒'}</div>
              <div class="nm">${E(Data.platformLabel(s.offer.platform))}</div>
              <div class="pr">${fmtBRL(s.offer.price)}</div>
              <div class="nm">${s.offer.shipping === 0 ? 'Frete grátis' : fmtBRL(s.offer.shipping) + ' frete'}</div>
              <div class="nm">${s.offer.daysToDeliver}d</div>
            </button>`).join('')}
        </div>
      </div>

      <div class="co-card">
        <div class="co-row"><span>Produto</span><span id="sumPrice">${fmtBRL(best.price)}</span></div>
        <div class="co-row"><span>Frete</span><span id="sumShip">${best.shipping === 0 ? 'Grátis' : fmtBRL(best.shipping)}</span></div>
        <div class="co-row"><span>Quantidade</span><span id="sumQty">1</span></div>
        <div class="co-row total"><span>Total</span><span id="sumTotal">${fmtBRL(best.price + best.shipping)}</span></div>
      </div>

      <div class="co-card" style="background:rgba(34,197,94,.05);border-color:rgba(34,197,94,.3)">
        <p style="margin:0;font-size:13px;line-height:1.5">
          🛡️ <b>Compra segura:</b> você será levado ao checkout oficial de
          <b>${E(Data.platformLabel(best.platform))}</b>. eShark <b>não cobra</b> nenhum valor —
          o pagamento e a entrega ocorrem no parceiro.
        </p>
      </div>

      <button class="btn-buy" id="coGo" type="button" data-pid="${E(p.id)}" data-platform="${E(best.platform)}">
        Continuar para ${E(Data.platformLabel(best.platform))} →
      </button>
      <p class="legal-mini">eShark é um agregador afiliado e recebe comissão sobre indicações. Origem da oferta sempre exibida.</p>
    `;
  }

  // ---------- FAVORITES ----------
  function renderFavorites(state) {
    const ids = state.favorites || [];
    const list = ids.map(Data.getById).filter(Boolean);
    $('#favCount').textContent = `${list.length} ite${list.length === 1 ? 'm' : 'ns'}`;
    const empty = $('#favEmpty');
    const grid = $('#favoritesList');
    if (!list.length) { empty.hidden = false; grid.innerHTML = ''; return; }
    empty.hidden = true;
    grid.innerHTML = list.map(p => cardHTML(p, { mode: state.mode, fav: true })).join('');
  }

  // ---------- ORDERS / CLICKS ----------
  function renderOrders(state) {
    const list = state.clicks || [];
    $('#ordersCount').textContent = `${list.length} ite${list.length === 1 ? 'm' : 'ns'}`;
    const empty = $('#ordersEmpty');
    const c = $('#ordersList');
    if (!list.length) { empty.hidden = false; c.innerHTML = ''; return; }
    empty.hidden = true;
    c.innerHTML = list.map(it => {
      const p = Data.getById(it.productId);
      if (!p) return '';
      const when = new Date(it.ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      return `
        <div class="order-item">
          <div class="ic">${E(p.icon)}</div>
          <div class="body">
            <h5>${E(p.name)}</h5>
            <small>${E(Data.platformLabel(it.platform))} · ${fmtBRL(it.price)} · ${E(when)}</small>
            <div class="actions">
              <a class="pill primary" href="${Sec.safeURL(it.url)}" target="_blank" rel="noopener noreferrer nofollow">Acompanhar em ${E(Data.platformLabel(it.platform))}</a>
              <button class="pill" data-pid="${E(p.id)}" data-action="reopen" type="button">Ver produto</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ---------- PROFILE ----------
  function renderProfile(state) {
    const u = state.user;
    $('#profName').textContent = u && u.name ? u.name : 'Visitante';
    $('#profEmail').textContent = u && u.email ? u.email : 'Faça login pra sincronizar';
    $('#profAvatar').textContent = u && u.name ? u.name[0].toUpperCase() : '👤';

    const clicks = state.clicks || [];
    $('#statClicks').textContent = clicks.length;
    const saved = clicks.reduce((acc, c) => {
      const p = Data.getById(c.productId);
      if (!p) return acc;
      return acc + Decision.estimatedSavings(p);
    }, 0);
    $('#statSaved').textContent = fmtBRL(saved).replace(/\,00$/,'');
    $('#statAlerts').textContent = (state.favorites || []).length;

    // sync prefs UI
    const p = state.prefs || {};
    $('#prefNotif').checked = !!p.notif;
    $('#prefDark').checked  = p.dark !== false;
    $('#prefSound').checked = !!p.sound;
    $('#prefMode').value    = p.mode || 'balanced';
  }

  // ---------- STATIC PAGES ----------
  function renderStatic(slug) {
    const c = $('#staticContainer');
    const PAGES = {
      terms: {
        title: '📄 Termos de Uso',
        body: `
          <p>Bem-vindo ao eShark. Ao usar este aplicativo, você concorda com os termos abaixo.</p>
          <h4>1. Natureza do serviço</h4>
          <p>eShark é um <b>agregador afiliado</b>. Não vendemos produtos diretamente. Quando você decide comprar, é redirecionado ao site parceiro (Shopee, Mercado Livre, Amazon etc.), onde a transação ocorre.</p>
          <h4>2. Comissões de afiliado</h4>
          <p>Recebemos comissão por indicações. Isso <b>não</b> aumenta o preço do produto para você.</p>
          <h4>3. Preços e disponibilidade</h4>
          <p>Os preços e condições são informados pelas lojas parceiras e podem variar. Sempre confirme no site oficial antes de finalizar.</p>
          <h4>4. Conta de usuário</h4>
          <p>Você é responsável por manter suas credenciais seguras. Atos suspeitos podem suspender a conta.</p>
          <h4>5. Limitação de responsabilidade</h4>
          <p>Não somos responsáveis pela entrega, qualidade do produto ou atendimento das lojas parceiras.</p>
        `
      },
      privacy: {
        title: '🔒 Política de Privacidade',
        body: `
          <p>Sua privacidade é prioridade. Aqui está o que coletamos e por quê:</p>
          <h4>O que coletamos</h4>
          <ul>
            <li>Dados de conta (email, nome) — quando você faz login</li>
            <li>Histórico de cliques — armazenado localmente, com assinatura criptográfica</li>
            <li>Preferências do app — somente no seu dispositivo</li>
          </ul>
          <h4>O que NÃO coletamos</h4>
          <ul>
            <li>Dados de cartão de crédito (não processamos pagamentos)</li>
            <li>Endereço de entrega</li>
            <li>Documentos pessoais</li>
          </ul>
          <h4>Seus direitos</h4>
          <p>Você pode exportar ou deletar seus dados a qualquer momento na tela <b>Perfil → Segurança</b>.</p>
          <h4>Cookies de afiliado</h4>
          <p>Ao clicar em "Comprar", o parceiro pode definir cookies para rastrear a indicação. Isso é como ganhamos comissão.</p>
        `
      },
      affiliate: {
        title: '💼 Como funciona o modelo afiliado',
        body: `
          <p>O eShark é <b>transparente</b>: lucramos com comissões dos parceiros, e isso fica claro pra você.</p>
          <h4>Fluxo da compra</h4>
          <ol>
            <li>Você descobre o produto no eShark</li>
            <li>Nossa IA escolhe a melhor oferta automaticamente</li>
            <li>Ao clicar em "Comprar", você é levado ao site parceiro</li>
            <li>A loja oficial processa pagamento e entrega</li>
            <li>Recebemos uma pequena comissão da loja (não de você)</li>
          </ol>
          <h4>Por que confiar?</h4>
          <p>Sempre mostramos a <b>origem</b> da oferta e o preço total real (produto + frete). Nunca escondemos isso.</p>
        `
      }
    };
    const page = PAGES[slug] || { title: 'eShark', body: '<p>Página não encontrada.</p>' };
    c.innerHTML = `
      <h3 style="margin:8px 0 12px">${E(page.title)}</h3>
      <div class="co-card" style="line-height:1.55">${page.body}</div>
    `;
  }

  // ---------- TOAST / MODAL ----------
  let toastTimer = null;
  function toast(msg, ms = 2200) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function modal({ title, body, ok = 'OK', cancel = 'Cancelar' }) {
    return new Promise(resolve => {
      const m = $('#modal');
      $('#modalTitle').textContent = title || '';
      $('#modalBody').textContent = body || '';
      $('#modalOk').textContent = ok;
      $('#modalCancel').textContent = cancel;
      m.hidden = false;
      const close = (val) => { m.hidden = true; resolve(val); };
      $('#modalOk').onclick = () => close(true);
      $('#modalCancel').onclick = () => close(false);
    });
  }

  // ---------- TIMERS / FLASH SALE ----------
  function startFlashTimer() {
    const el = $('#flashTimer');
    if (!el) return;
    const target = Date.now() + (3 * 60 * 60 * 1000) - (Date.now() % 60000);
    function tick() {
      const left = Math.max(0, target - Date.now());
      const h = Math.floor(left / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      const s = Math.floor((left % 60000) / 1000);
      el.textContent = [h, m, s].map(x => String(x).padStart(2, '0')).join(':');
    }
    tick();
    setInterval(tick, 1000);
  }

  global.UI = {
    renderHome, renderSearch, renderProduct, renderCheckout,
    renderFavorites, renderOrders, renderProfile, renderStatic,
    cardHTML, toast, modal, startFlashTimer, fmtBRL, fmtPct
  };
})(window);
