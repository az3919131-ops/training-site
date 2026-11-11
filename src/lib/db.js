// طبقة البيانات: Netlify Blobs مع بديل تلقائي (localStorage في المتصفح، أو ذاكرة مؤقتة محلياً)
export const STORES = [
  'users', 'free_youtube_courses', 'paid_job_courses', 'learning_paths',
  'user_plans_and_reviews', 'hourly_bookings', 'subscriptions', 'certificates',
  'notifications', 'config', 'content_library', 'content_files', 'wallet_ledger'
];

const mem = (globalThis.__ILTIZAM_MEM ||= {});
const hasLS = typeof localStorage !== 'undefined';

function fallback(name) {
  const prefix = `iltizam.db.${name}.`;
  if (hasLS) {
    return {
      async get(k) { const v = localStorage.getItem(prefix + k); return v ? JSON.parse(v) : null; },
      async set(k, v) { localStorage.setItem(prefix + k, JSON.stringify(v)); },
      async del(k) { localStorage.removeItem(prefix + k); },
      async keys() { return Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length)); }
    };
  }
  const m = (mem[name] ||= new Map());
  return {
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : null; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async del(k) { m.delete(k); },
    async keys() { return [...m.keys()]; }
  };
}

let blobsMod;
async function open(name) {
  if (!hasLS && blobsMod === undefined) {
    blobsMod = await import('@netlify/blobs').catch(() => null);
  }
  if (blobsMod) {
    try {
      const s = blobsMod.getStore({ name, consistency: 'strong' });
      return {
        get: k => s.get(k, { type: 'json' }),
        set: (k, v) => s.setJSON(k, v),
        del: k => s.delete(k),
        keys: async () => (await s.list()).blobs.map(b => b.key)
      };
    } catch { /* خارج بيئة Netlify */ }
  }
  return fallback(name);
}

async function rawStore(name) {
  await open(name);
  if (!blobsMod) return null;
  try { return blobsMod.getStore({ name, consistency: 'strong' }); } catch { return null; }
}

export const db = {
  // ملفات ثنائية (مرفقات وفيديو): Netlify Blobs مباشرة، أو base64 في المخزن البديل
  async putFile(store, key, buffer, meta = {}) {
    const s = await rawStore(store);
    if (s) return s.set(String(key), buffer, { metadata: meta });
    return (await open(store)).set(String(key), { b64: Buffer.from(buffer).toString('base64'), meta });
  },
  async getFile(store, key) {
    const s = await rawStore(store);
    if (s) { const r = await s.getWithMetadata(String(key), { type: 'arrayBuffer' }); return r ? { data: r.data, meta: r.metadata } : null; }
    const r = await (await open(store)).get(String(key));
    return r ? { data: Buffer.from(r.b64, 'base64'), meta: r.meta } : null;
  },
  async get(store, key) { return (await open(store)).get(String(key)); },
  async set(store, key, value) { await (await open(store)).set(String(key), value); return value; },
  async del(store, key) { await (await open(store)).del(String(key)); },
  async list(store) {
    const s = await open(store);
    const keys = await s.keys();
    return (await Promise.all(keys.map(k => s.get(k)))).filter(Boolean);
  }
};
