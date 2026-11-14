// Imitação local de window.claude.use(...) para a Administração.
// Grava no servidor local (local/db, local/assets). Nada vai para o claude.ai.
(() => {
  const listeners = new Map(); // coleção → Set de callbacks
  const json = (r) => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.json(); };

  async function notify(col) {
    const set = listeners.get(col);
    if (!set || !set.size) return;
    const docs = await fetch('/api/db/' + col).then(json);
    const snap = { docs: docs.map((d) => ({ id: d.id, data: () => d.data, exists: true })), size: docs.length, empty: !docs.length };
    set.forEach((s) => { try { s.next(snap); } catch (e) { console.error(e); } });
  }
  const colOf = (p) => p.split('/').slice(0, -1).join('/');

  const db = {
    collection(col) {
      return {
        onSnapshot(next, error) {
          if (!listeners.has(col)) listeners.set(col, new Set());
          const s = { next, error }; listeners.get(col).add(s);
          notify(col).catch((e) => error && error(e));
          return () => listeners.get(col).delete(s);
        },
        async get() { const docs = await fetch('/api/db/' + col).then(json); return { docs: docs.map((d) => ({ id: d.id, data: () => d.data, exists: true })) }; },
        doc: (id) => db.doc(col + '/' + id),
      };
    },
    doc(p) {
      const w = (method, body) => fetch('/api/db/' + p, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(json).then(() => notify(colOf(p)));
      return {
        id: p.split('/').pop(),
        async get() { const r = await fetch('/api/db/' + p).then(json); return { id: p.split('/').pop(), exists: r.exists, data: () => r.data }; },
        set: (d) => w('PUT', d),
        update: (d) => w('PATCH', d),
        delete: () => w('DELETE', {}),
      };
    },
  };

  const user = {
    canEdit: async () => true,
    id: async () => 'u_local_dev',
    profiles: async (ids) => Object.fromEntries(ids.map((i) => [i, { name: i === 'u_local_dev' ? 'Você (local)' : 'Pessoa ' + i.slice(-4) }])),
  };

  const assets = {
    async upload(blob, opts = {}) {
      return fetch('/api/assets', { method: 'POST', headers: { 'content-type': opts.type || blob.type || 'application/octet-stream' }, body: blob }).then(json);
    },
    async delete(id) { await fetch('/api/assets/' + id, { method: 'DELETE' }); },
    url: (id) => '/_blob/' + id,
  };

  const caps = { user, db, assets };
  window.claude = { use: async (name) => caps[name] || null, arquivoUrl: assets.url };
  console.info('[local] claude.use imitado: user (admin), db e assets locais');
})();
