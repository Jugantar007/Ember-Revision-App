/* loader.js — content loading and all the queries over it.
 *
 * data/index.json lists the sections; each section is its own JSON file so you can
 * edit one topic on github.com without touching anything else. Everything is pulled
 * in at boot (the whole bank is a few hundred KB at most) which keeps search,
 * stats and mixed-section queues simple.
 */

const Content = (function () {
  let index = null;
  let sections = [];
  const bySection = new Map();   // sectionId -> [items]
  const byId = new Map();        // itemId   -> item (with _section attached)
  let loadError = null;

  async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return res.json();
  }

  async function ready() {
    if (index) return index;
    try {
      index = await fetchJson('./data/index.json');
      const files = index.sections.map(async (s) => {
        const data = await fetchJson(`./data/${s.file}`);
        const items = (data.items || []).map((it) => Object.assign({}, it, {
          _section: s.id,
          _sectionTitle: s.title
        }));
        bySection.set(s.id, items);
        items.forEach((it) => byId.set(it.id, it));
        return Object.assign({}, s, { count: items.length });
      });
      sections = await Promise.all(files);
    } catch (e) {
      loadError = e;
      throw e;
    }
    return index;
  }

  const all = () => Array.from(byId.values());
  const items = (sid) => bySection.get(sid) || [];
  const get = (id) => byId.get(id) || null;
  const allIds = () => Array.from(byId.keys());

  /* ------------------------------ queues -------------------------------- */

  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function dueItems(sid) {
    const pool = sid ? items(sid) : all();
    return pool.filter((it) => Store.isDue(it.id));
  }

  function newItems(sid) {
    const pool = sid ? items(sid) : all();
    return pool.filter((it) => Store.isNew(it.id));
  }

  /**
   * The study queue: everything already due first (oldest due date first, so
   * nothing rots), then a capped trickle of unseen cards.
   */
  function buildQueue(opts) {
    const o = Object.assign({ section: null, limit: 40, includeNew: true }, opts || {});

    const due = dueItems(o.section).sort((a, b) => {
      const ca = Store.card(a.id), cb = Store.card(b.id);
      if (ca.due !== cb.due) return ca.due < cb.due ? -1 : 1;
      return cb.lapses - ca.lapses;             // shakiest first within a day
    });

    let queue = due.slice(0, o.limit);

    if (o.includeNew && queue.length < o.limit) {
      const room = o.limit - queue.length;
      const newCap = Math.max(0, Store.settings.newPerDay - Store.day().newSeen);
      const take = Math.min(room, o.section ? room : newCap || room);
      queue = queue.concat(newItems(o.section).slice(0, take));
    }
    return queue;
  }

  function weakItems() {
    return all()
      .filter((it) => SRS.isLeech(Store.card(it.id)))
      .sort((a, b) => Store.card(b.id).lapses - Store.card(a.id).lapses);
  }

  /** Random mixed set for Interview Simulation — biased toward cards you've seen. */
  function simQueue(n) {
    const seen = all().filter((it) => !Store.isNew(it.id));
    const pool = seen.length >= n ? seen : all();
    return shuffle(pool).slice(0, n);
  }

  function quizQueue(sid, n) {
    const pool = (sid ? items(sid) : all()).filter((it) => it.mcq && it.mcq.options);
    return shuffle(pool).slice(0, n || 10);
  }

  function search(q) {
    const needle = (q || '').trim().toLowerCase();
    if (needle.length < 2) return [];
    return all().filter((it) => {
      const hay = [it.q, it.a_short, it.code, (it.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.includes(needle);
    }).slice(0, 60);
  }

  /* ------------------------------ stats --------------------------------- */

  function sectionStats(sid) {
    const list = items(sid);
    let mastered = 0, seen = 0, due = 0, leeches = 0;
    list.forEach((it) => {
      const c = Store.card(it.id);
      if (c) {
        seen++;
        if (SRS.isMastered(c)) mastered++;
        if (c.due <= Store.today()) due++;
        if (SRS.isLeech(c)) leeches++;
      }
    });
    return {
      total: list.length,
      seen, mastered, due, leeches,
      pct: list.length ? Math.round((mastered / list.length) * 100) : 0
    };
  }

  function globalStats() {
    const ids = allIds();
    let seen = 0, mastered = 0, due = 0, leeches = 0;
    ids.forEach((id) => {
      const c = Store.card(id);
      if (!c) return;
      seen++;
      if (SRS.isMastered(c)) mastered++;
      if (c.due <= Store.today()) due++;
      if (SRS.isLeech(c)) leeches++;
    });
    return { total: ids.length, seen, mastered, due, leeches, newLeft: ids.length - seen };
  }

  return {
    ready,
    get index() { return index; },
    get sections() { return sections; },
    get error() { return loadError; },
    all, items, get, allIds, shuffle,
    dueItems, newItems, buildQueue, weakItems, simQueue, quizQueue, search,
    sectionStats, globalStats
  };
})();
