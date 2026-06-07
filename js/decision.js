/* eShark — Decision Engine
 * Computes the BEST offer for each product based on:
 *  - normalized price + shipping (real cost)
 *  - delivery time
 *  - seller rating
 *  - perks (free shipping, official, full, prime, etc.)
 *  - user mode (balanced | cheap | fast | trust)
 *
 * Returns: { best, scored: [{offer, score, breakdown, badges, reason}] }
 */
(function (global) {
  'use strict';

  const PERK_BONUS = {
    frete_gratis: 0.06,
    full:         0.04,    // Mercado Livre Full
    prime:        0.04,    // Amazon Prime
    oficial:      0.05,    // Loja oficial
    cupom:        0.02,    // tem cupom
    parcelado:    0.01     // parcelamento sem juros
  };

  const MODE_WEIGHTS = {
    balanced: { price: 0.50, ship: 0.15, time: 0.20, rep: 0.15 },
    cheap:    { price: 0.70, ship: 0.10, time: 0.10, rep: 0.10 },
    fast:     { price: 0.20, ship: 0.10, time: 0.55, rep: 0.15 },
    trust:    { price: 0.30, ship: 0.10, time: 0.20, rep: 0.40 }
  };

  function totalCost(o) { return Number(o.price) + Number(o.shipping || 0); }

  // Normalize values to 0..1 where 0 = best (lowest), 1 = worst (highest)
  function normalize(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 0);
    return values.map(v => (v - min) / (max - min));
  }

  // For ratings: invert (higher rating is better)
  function normalizeInverted(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => 0);
    return values.map(v => 1 - ((v - min) / (max - min)));
  }

  function platformReputation(p, sales) {
    const base = { shopee: 0.85, ml: 0.95, amazon: 0.92 }[p] || 0.80;
    const salesBoost = Math.min(0.05, (sales || 0) / 200000); // up to +0.05
    return Math.min(1, base + salesBoost);
  }

  function buildBadges(o, ctx) {
    const b = [];
    if ((o.perks || []).includes('frete_gratis') || o.shipping === 0) b.push('🚚 Frete grátis');
    if ((o.perks || []).includes('full')) b.push('⚡ Mercado Livre Full');
    if ((o.perks || []).includes('prime')) b.push('📦 Prime');
    if ((o.perks || []).includes('oficial')) b.push('🏢 Loja oficial');
    if ((o.perks || []).includes('cupom')) b.push('🎟️ Cupom');
    if ((o.perks || []).includes('parcelado')) b.push('💳 Parcelado');
    if (o.daysToDeliver <= 2) b.push('🚀 Entrega ultrarrápida');
    if (o.sellerRating >= 4.8) b.push('⭐ Vendedor top');
    return b;
  }

  function reasonFor(scored, idx) {
    const me = scored[idx];
    const o = me.offer;
    const others = scored.filter((_, i) => i !== idx);
    const cheapestElsewhere = others.length ? Math.min(...others.map(s => totalCost(s.offer))) : null;
    const myCost = totalCost(o);

    const parts = [];
    if (o.shipping === 0) parts.push('frete grátis');
    if (o.daysToDeliver <= 3) parts.push('entrega rápida');
    if (o.sellerRating >= 4.7) parts.push('vendedor confiável');
    if (cheapestElsewhere !== null && myCost <= cheapestElsewhere) parts.push('menor preço total');
    if (parts.length === 0) parts.push('melhor combinação geral');
    return 'Recomendado por: ' + parts.join(', ') + '.';
  }

  function evaluate(product, opts = {}) {
    const offers = (product && product.offers) || [];
    if (!offers.length) return { best: null, scored: [] };

    const mode = MODE_WEIGHTS[opts.mode] ? opts.mode : 'balanced';
    const w = MODE_WEIGHTS[mode];

    // Filter ridiculous offers (reputation too low)
    const valid = offers.filter(o => o.sellerRating >= 4.0);
    const pool = valid.length ? valid : offers;

    const totals = pool.map(totalCost);
    const ships  = pool.map(o => Number(o.shipping || 0));
    const times  = pool.map(o => Number(o.daysToDeliver || 30));
    const reps   = pool.map(o => platformReputation(o.platform, o.sellerSales) * 0.5 + (o.sellerRating / 5) * 0.5);

    const nT = normalize(totals);
    const nS = normalize(ships);
    const nD = normalize(times);
    const nR = normalizeInverted(reps);

    let scored = pool.map((o, i) => {
      let s = (w.price * nT[i]) + (w.ship * nS[i]) + (w.time * nD[i]) + (w.rep * nR[i]);
      let bonus = 0;
      (o.perks || []).forEach(k => bonus += (PERK_BONUS[k] || 0));
      if (o.shipping === 0) bonus += 0.04;
      if (o.daysToDeliver <= 2) bonus += 0.05;
      if (o.sellerRating < 4.3) bonus -= 0.10; // penalty

      const score = +(s - bonus).toFixed(4);
      return {
        offer: o,
        score,
        breakdown: {
          totalCost: totals[i],
          nTotal: +nT[i].toFixed(3),
          nShip:  +nS[i].toFixed(3),
          nDays:  +nD[i].toFixed(3),
          nRep:   +nR[i].toFixed(3),
          bonus:  +bonus.toFixed(3),
          mode
        },
        badges: buildBadges(o)
      };
    });

    scored.sort((a, b) => a.score - b.score);
    scored.forEach((s, i) => { s.reason = reasonFor(scored, i); });

    return { best: scored[0], scored, mode };
  }

  // discount % vs original (from product.oldPrice)
  function discountPct(product, offer) {
    if (!product || !product.oldPrice || !offer) return 0;
    const dp = product.oldPrice;
    if (dp <= offer.price) return 0;
    return Math.round(((dp - offer.price) / dp) * 100);
  }

  // estimated savings vs the worst offer in the same group
  function estimatedSavings(product) {
    if (!product || !product.offers || product.offers.length < 2) return 0;
    const totals = product.offers.map(totalCost);
    return +(Math.max(...totals) - Math.min(...totals)).toFixed(2);
  }

  global.Decision = { evaluate, totalCost, discountPct, estimatedSavings, MODE_WEIGHTS };
})(window);
