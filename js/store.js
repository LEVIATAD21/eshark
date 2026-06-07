/* eShark — Local store (favorites, click history, prefs)
 * Persists via Sec.safeSet (signed) to detect tampering.
 */
(function (global) {
  'use strict';

  const KEYS = {
    fav: 'favorites',
    clk: 'clicks',
    pref: 'prefs',
    seen: 'seen_onboarding',
    user: 'user'
  };

  const Store = {
    async getFavorites() { return (await Sec.safeGet(KEYS.fav, [])) || []; },
    async toggleFavorite(productId) {
      if (!Sec.Validate.productId(productId)) return false;
      const list = await this.getFavorites();
      const i = list.indexOf(productId);
      if (i >= 0) list.splice(i, 1); else list.unshift(productId);
      // cap to 200
      const capped = list.slice(0, 200);
      await Sec.safeSet(KEYS.fav, capped);
      return list.indexOf(productId) >= 0 ? true : false;
    },
    async isFavorite(id) { return (await this.getFavorites()).includes(id); },

    async getClicks() { return (await Sec.safeGet(KEYS.clk, [])) || []; },
    async logClick(entry) {
      if (!entry || !Sec.Validate.productId(entry.productId)) return;
      const list = await this.getClicks();
      list.unshift({
        productId: entry.productId,
        platform: String(entry.platform || '').slice(0, 20),
        url: Sec.isAllowedAffiliate(entry.url) ? entry.url : null,
        price: Number(entry.price) || 0,
        ts: Date.now()
      });
      await Sec.safeSet(KEYS.clk, list.slice(0, 200));
    },
    async clearClicks() { await Sec.safeSet(KEYS.clk, []); },

    async getPrefs() {
      return (await Sec.safeGet(KEYS.pref, {
        notif: true, dark: true, sound: false, mode: 'balanced'
      })) || {};
    },
    async setPref(k, v) {
      const p = await this.getPrefs();
      p[k] = v;
      await Sec.safeSet(KEYS.pref, p);
    },

    async getUser() { return (await Sec.safeGet(KEYS.user, null)); },
    async setUser(u) { await Sec.safeSet(KEYS.user, u); },
    async logout() { Sec.safeRemove(KEYS.user); },

    async hasSeenOnboarding() { return !!(await Sec.safeGet(KEYS.seen, false)); },
    async markOnboardingSeen() { await Sec.safeSet(KEYS.seen, true); },

    async exportAll() {
      return {
        favorites: await this.getFavorites(),
        clicks: await this.getClicks(),
        prefs: await this.getPrefs(),
        user: await this.getUser(),
        ts: Date.now(), version: Sec.VERSION
      };
    },
    async clearAll() {
      Object.values(KEYS).forEach(k => Sec.safeRemove(k));
    }
  };

  global.Store = Store;
})(window);
