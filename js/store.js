/* store.js — all persistent state lives here.
 *
 * Everything is kept in one localStorage key so a backup is a single JSON blob.
 * Browsers can clear site storage without warning, so Settings offers export/import.
 * Nothing here knows about the DOM.
 */

const Store = (function () {
  const KEY = 'pyrev.state.v1';
  const SCHEMA = 1;

  const DEFAULTS = {
    schema: SCHEMA,
    profile: { name: '' },    // asked once on first launch; drives the greeting
    settings: {
      dailyCards: 40,
      dailyMinutes: 60,
      newPerDay: 12,          // cap on unseen cards introduced per day
      reminders: true,
      reminderTimes: ['09:00', '20:00'],
      haptics: true,
      showIntervals: true
    },
    cards: {},                // id -> { box, ease, due, lapses, seen, last, wrong }
    days: {},                 // 'YYYY-MM-DD' -> { cards, minutes, xp, newSeen, done }
    streak: { current: 0, best: 0, freezes: 0, lastDone: null },
    xp: 0,
    quests: {},               // 'YYYY-MM-DD' -> { questId: true }
    badges: [],
    push: { subscription: null, enabledAt: null },
    createdAt: null
  };

  let state = load();

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function merge(base, over) {
    const out = clone(base);
    if (!over || typeof over !== 'object') return out;
    for (const k of Object.keys(over)) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = merge(base[k], over[k]);
      } else if (over[k] !== undefined) {
        out[k] = over[k];
      }
    }
    return out;
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (_) { /* private mode */ }
    if (!raw) {
      const fresh = clone(DEFAULTS);
      fresh.createdAt = new Date().toISOString();
      return fresh;
    }
    try {
      const parsed = JSON.parse(raw);
      return merge(DEFAULTS, parsed);
    } catch (_) {
      const fresh = clone(DEFAULTS);
      fresh.createdAt = new Date().toISOString();
      return fresh;
    }
  }

  let saveTimer = null;
  function save() {
    // Debounced: rating a card writes a few fields, no need to hit storage each time.
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 120);
  }

  function flush() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[store] save failed', e);
    }
  }

  // Persist immediately when the app is backgrounded — Android can kill the tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  /* ------------------------------- dates -------------------------------- */

  function dayKey(d) {
    const dt = d ? new Date(d) : new Date();
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    return dayKey(dt);
  }

  function daysBetween(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number);
    const [y2, m2, d2] = b.split('-').map(Number);
    const t1 = new Date(y1, m1 - 1, d1).getTime();
    const t2 = new Date(y2, m2 - 1, d2).getTime();
    return Math.round((t2 - t1) / 86400000);
  }

  const today = () => dayKey();

  /* ------------------------------- cards -------------------------------- */

  function card(id) {
    return state.cards[id] || null;
  }

  function setCard(id, patch) {
    state.cards[id] = Object.assign({}, state.cards[id] || {}, patch);
    save();
    return state.cards[id];
  }

  function isDue(id, onDay) {
    const c = state.cards[id];
    if (!c) return false;                 // unseen cards are "new", not "due"
    return c.due <= (onDay || today());
  }

  function isNew(id) { return !state.cards[id]; }

  /* ------------------------------- days --------------------------------- */

  function day(key) {
    const k = key || today();
    if (!state.days[k]) {
      state.days[k] = { cards: 0, minutes: 0, xp: 0, newSeen: 0, done: false };
    }
    return state.days[k];
  }

  function bumpDay(patch) {
    const d = day();
    for (const k of Object.keys(patch)) {
      d[k] = (typeof d[k] === 'number') ? d[k] + patch[k] : patch[k];
    }
    save();
    return d;
  }

  /* ------------------------------- streak ------------------------------- */

  function markDayDone() {
    const d = day();
    if (d.done) return { changed: false, streak: state.streak.current };
    d.done = true;

    const s = state.streak;
    const t = today();
    if (s.lastDone === null) {
      s.current = 1;
    } else {
      const gap = daysBetween(s.lastDone, t);
      if (gap === 1) {
        s.current += 1;
      } else if (gap > 1) {
        // One freeze token covers exactly one missed day.
        if (gap === 2 && s.freezes > 0) {
          s.freezes -= 1;
          s.current += 1;
        } else {
          s.current = 1;
        }
      }
    }
    s.lastDone = t;
    if (s.current > s.best) s.best = s.current;

    // Earn a freeze token every 7 days, capped at 2.
    if (s.current % 7 === 0 && s.freezes < 2) s.freezes += 1;

    save();
    return { changed: true, streak: s.current };
  }

  /** Streak shown in the UI: expires if the last completed day is older than yesterday. */
  function liveStreak() {
    const s = state.streak;
    if (!s.lastDone) return 0;
    const gap = daysBetween(s.lastDone, today());
    if (gap <= 1) return s.current;
    if (gap === 2 && s.freezes > 0) return s.current;   // still salvageable today
    return 0;
  }

  /* ------------------------------- xp ----------------------------------- */

  function addXp(n) {
    state.xp += n;
    day().xp += n;
    save();
    return state.xp;
  }

  const LEVELS = [0, 150, 400, 800, 1400, 2200, 3200, 4500, 6200, 8400, 11000];
  function level() {
    let lv = 1;
    for (let i = 0; i < LEVELS.length; i++) if (state.xp >= LEVELS[i]) lv = i + 1;
    const cur = LEVELS[lv - 1] || 0;
    const next = LEVELS[lv] || (cur + 3000);
    return { level: lv, into: state.xp - cur, span: next - cur, next };
  }

  /* ------------------------------- quests ------------------------------- */

  function questsToday() {
    const k = today();
    if (!state.quests[k]) state.quests[k] = {};
    // Keep only the last 14 days of quest records.
    const keys = Object.keys(state.quests).sort();
    while (keys.length > 14) delete state.quests[keys.shift()];
    return state.quests[k];
  }

  function completeQuest(id, xp) {
    const q = questsToday();
    if (q[id]) return false;
    q[id] = true;
    addXp(xp || 0);
    save();
    return true;
  }

  /* ------------------------------- badges ------------------------------- */

  function awardBadge(id) {
    if (state.badges.includes(id)) return false;
    state.badges.push(id);
    save();
    return true;
  }

  /* ------------------------------- backup ------------------------------- */

  function exportJson() { return JSON.stringify(state, null, 2); }

  function importJson(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error('Not an object');
    state = merge(DEFAULTS, parsed);
    state.schema = SCHEMA;
    flush();
    return true;
  }

  function reset(what) {
    if (what === 'progress') {
      state.cards = {};
      state.days = {};
      state.quests = {};
      state.streak = clone(DEFAULTS.streak);
      state.xp = 0;
      state.badges = [];
    } else {
      state = clone(DEFAULTS);
      state.createdAt = new Date().toISOString();
    }
    flush();
  }

  function setName(name) {
    state.profile.name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    flush();
    return state.profile.name;
  }

  return {
    get state() { return state; },
    get settings() { return state.settings; },
    get name() { return state.profile.name; },
    setName,
    save, flush,
    today, dayKey, addDays, daysBetween,
    card, setCard, isDue, isNew,
    day, bumpDay,
    markDayDone, liveStreak,
    addXp, level,
    questsToday, completeQuest,
    awardBadge,
    exportJson, importJson, reset
  };
})();
