// Stand-in for the claude.ai `db` and `user` capabilities: tabs of one browser share documents through
// localStorage + a BroadcastChannel. Each tab is a different player; `#readonly` in the URL makes a
// view-only one. Writes outside your own scores/<id> document are refused, like the real rules.
(() => {
  const KEY = 'mockdb';
  const bc = new BroadcastChannel('mockdb');
  const read = () => JSON.parse(localStorage.getItem(KEY) || '{}');
  const uid = 'u' + Math.random().toString(36).slice(2, 8);
  const readOnly = location.hash === '#readonly';
  const subs = new Set();
  const notify = () => subs.forEach((f) => f());
  bc.onmessage = notify;
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapFor = (coll) => {
    const all = read();
    const docs = Object.keys(all).filter((p) => p.split('/').length === 2 && p.startsWith(coll + '/')).sort()
      .map((p) => ({ id: p.split('/')[1], exists: true, data: () => all[p], metadata: meta }));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
  };
  const db = {
    collection: (c) => ({
      path: c,
      onSnapshot(next) { const f = () => next(snapFor(c)); subs.add(f); setTimeout(f, 10); return () => subs.delete(f); },
      doc: (id) => db.doc(c + '/' + id),
    }),
    doc: (p) => ({
      path: p,
      set(data) {
        if (readOnly || p !== 'scores/' + uid) return Promise.reject({ code: 'invalid_argument', message: 'refused' });
        const all = read();
        all[p] = JSON.parse(JSON.stringify(data));
        localStorage.setItem(KEY, JSON.stringify(all));
        bc.postMessage(1);
        setTimeout(notify, 5);
        return Promise.resolve();
      },
    }),
  };
  const user = { id: () => Promise.resolve(uid), can: () => Promise.resolve(!readOnly), canEdit: () => Promise.resolve(false), isOwner: () => Promise.resolve(false) };
  const prev = window.claude;
  window.claude = { use: (n) => (n === 'db' ? Promise.resolve(db) : n === 'user' ? Promise.resolve(user) : prev ? prev.use(n) : Promise.resolve(null)) };
})();
