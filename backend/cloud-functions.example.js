/* eShark — Cloud Functions (exemplo)
 * Implementa lógica server-side que NÃO pode rodar no cliente:
 *  - rate-limit por usuário (counter em /rate/{uid})
 *  - normalização e validação anti-fraude antes de gravar clicks
 *  - cron diário pra coletar preços e atualizar /products
 *  - função pra enviar push notification quando alerta dispara
 *
 * Deploy:
 *  firebase init functions
 *  cp cloud-functions.example.js functions/index.js
 *  cd functions && npm i firebase-admin firebase-functions
 *  firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Whitelist platforms
const PLATFORMS = new Set(['shopee', 'ml', 'amazon', 'magalu', 'aliexpress']);

// ---------- RATE LIMIT MIDDLEWARE ----------
async function checkRate(uid) {
  const ref = db.doc(`rate/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = admin.firestore.Timestamp.now();
    const window = 60 * 1000;
    if (!snap.exists) {
      tx.set(ref, { windowStart: now, count: 1 });
      return true;
    }
    const data = snap.data();
    const elapsed = now.toMillis() - data.windowStart.toMillis();
    if (elapsed > window) {
      tx.set(ref, { windowStart: now, count: 1 });
      return true;
    }
    if (data.count >= 60) return false;
    tx.update(ref, { count: data.count + 1 });
    return true;
  });
}

// ---------- LOG CLICK (callable) ----------
exports.logClick = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'login required');
  const uid = context.auth.uid;

  // validation
  const { productId, platform, price, shipping, sessionId } = data || {};
  if (typeof productId !== 'string' || productId.length > 40) throw new functions.https.HttpsError('invalid-argument', 'bad productId');
  if (!PLATFORMS.has(platform)) throw new functions.https.HttpsError('invalid-argument', 'bad platform');
  if (typeof price !== 'number' || price < 0 || price > 1_000_000) throw new functions.https.HttpsError('invalid-argument', 'bad price');
  if (typeof shipping !== 'number' || shipping < 0) throw new functions.https.HttpsError('invalid-argument', 'bad shipping');
  if (typeof sessionId !== 'string' || sessionId.length > 64) throw new functions.https.HttpsError('invalid-argument', 'bad session');

  // rate-limit
  const ok = await checkRate(uid);
  if (!ok) throw new functions.https.HttpsError('resource-exhausted', 'too many requests');

  // anti-duplicate (same product within 10s)
  const dupQuery = await db.collection(`users/${uid}/clicks`)
    .where('productId', '==', productId)
    .orderBy('ts', 'desc').limit(1).get();
  if (!dupQuery.empty) {
    const last = dupQuery.docs[0].data();
    if (Date.now() - last.ts.toMillis() < 10000) {
      return { ok: true, dedup: true };
    }
  }

  await db.collection(`users/${uid}/clicks`).add({
    productId, platform, price, shipping,
    sessionId,
    ts: admin.firestore.FieldValue.serverTimestamp(),
    ip: context.rawRequest.ip || null,
    ua: (context.rawRequest.headers['user-agent'] || '').slice(0, 200)
  });
  return { ok: true };
});

// ---------- PRICE ALERT CRON (diário) ----------
exports.runPriceAlerts = functions.pubsub.schedule('every 6 hours').onRun(async () => {
  const alerts = await db.collectionGroup('alerts').get();
  for (const a of alerts.docs) {
    const data = a.data();
    const pSnap = await db.doc(`products/${data.productId}`).get();
    if (!pSnap.exists) continue;
    const product = pSnap.data();
    const lowest = Math.min(...(product.offers || []).map(o => o.price));
    if (lowest <= data.targetPrice) {
      // Em produção: enviar via FCM
      console.log('alert hit', a.ref.path, 'target', data.targetPrice, 'now', lowest);
    }
  }
});

// ---------- GDPR EXPORT ----------
exports.exportMyData = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'login required');
  const uid = context.auth.uid;
  const [user, favs, clicks, alerts] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/favorites`).get(),
    db.collection(`users/${uid}/clicks`).get(),
    db.collection(`users/${uid}/alerts`).get(),
  ]);
  return {
    user: user.data(),
    favorites: favs.docs.map(d => d.data()),
    clicks: clicks.docs.map(d => d.data()),
    alerts: alerts.docs.map(d => d.data()),
    exportedAt: new Date().toISOString()
  };
});

// ---------- GDPR DELETE ----------
exports.deleteMyAccount = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'login required');
  const uid = context.auth.uid;
  const subs = ['favorites', 'clicks', 'alerts'];
  for (const s of subs) {
    const snap = await db.collection(`users/${uid}/${s}`).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  await db.doc(`users/${uid}`).delete();
  await admin.auth().deleteUser(uid);
  return { ok: true };
});
