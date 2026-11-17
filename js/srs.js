/* srs.js — SM-2 lite spaced repetition scheduler.
 *
 * Two knobs decide when a card comes back:
 *   box  — which rung of the interval ladder the card sits on (shared, predictable)
 *   ease — a per-card multiplier that drifts with how you rate it (personal)
 *
 * interval = BASE[box] * (ease / 2.5) * ratingMultiplier
 *
 * Keeping the ladder explicit (rather than pure SM-2 compounding) means you can
 * look at a card and know roughly when it is due, which makes the thing debuggable.
 */

const SRS = (function () {
  // The interval ladder. `box` counts successful reps: a card in box b last
  // received BASE[b-1] days. Box 0 means new or just-lapsed (relearning).
  const BASE = [1, 3, 7, 16, 35, 90, 180];
  const MAX_BOX = BASE.length;                 // boxes run 0..7

  const RATINGS = [
    { id: 0, label: 'Again', mult: 0,    dEase: -0.20, dBox: 'reset' },
    { id: 1, label: 'Hard',  mult: 0.65, dEase: -0.15, dBox: 0 },
    { id: 2, label: 'Good',  mult: 1.00, dEase: 0,     dBox: +1 },
    { id: 3, label: 'Easy',  mult: 1.35, dEase: +0.15, dBox: +2 }
  ];

  const EASE_MIN = 1.3;
  const EASE_MAX = 2.8;
  const EASE_START = 2.5;
  const LEECH_AT = 4;
  const MASTERY_BOX = 5;   // box >= 5 means a 35-day interval or longer

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function fresh() {
    return { box: 0, ease: EASE_START, due: Store.today(), lapses: 0, seen: 0, ivl: 0, last: null, wrong: 0 };
  }

  /** The box a rating moves a card to. */
  function nextBox(box, r) {
    if (r.dBox === 'reset') return 0;
    return clamp(box + r.dBox, 0, MAX_BOX);
  }

  /** Days until the next review, given the box a card has landed in. */
  function intervalFor(box, ease, mult) {
    if (mult === 0) return 1;
    const rung = BASE[Math.max(1, box) - 1];          // box 0 borrows the first rung
    return clamp(Math.round(rung * (ease / EASE_START) * mult), 1, 365);
  }

  /** Interval in days a rating would produce, without mutating anything. */
  function preview(c, ratingId) {
    const cur = c || fresh();
    const r = RATINGS[ratingId];
    if (r.mult === 0) return 1;                       // Again always comes back tomorrow
    const ease = clamp(cur.ease + r.dEase, EASE_MIN, EASE_MAX);
    return intervalFor(nextBox(cur.box, r), ease, r.mult);
  }

  /** Apply a rating. Returns the new card state (already persisted). */
  function rate(id, ratingId) {
    const cur = Store.card(id) || fresh();
    const r = RATINGS[ratingId];

    const ease = clamp(cur.ease + r.dEase, EASE_MIN, EASE_MAX);
    const box = nextBox(cur.box, r);
    const ivl = preview(cur, ratingId);
    const lapses = cur.lapses + (ratingId === 0 ? 1 : 0);

    return Store.setCard(id, {
      box,
      ease: Math.round(ease * 100) / 100,
      ivl,
      due: Store.addDays(Store.today(), ivl),
      lapses,
      seen: cur.seen + 1,
      wrong: cur.wrong + (ratingId === 0 ? 1 : 0),
      last: Store.today()
    });
  }

  /** XP for a rating — harder cards and higher boxes are worth more. */
  function xpFor(c, ratingId, difficulty) {
    if (ratingId === 0) return 2;                       // you still showed up
    const base = 6 + (difficulty || 1) * 2;
    const boxBonus = Math.min(6, (c ? c.box : 0) * 1.5);
    return Math.round(base + boxBonus);
  }

  function isLeech(c) { return !!c && c.lapses >= LEECH_AT; }
  function isMastered(c) { return !!c && c.box >= MASTERY_BOX; }

  function fmtInterval(days) {
    if (days < 1) return '<1d';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (Math.round(days / 36.5) / 10) + 'y';
  }

  /** Count cards per box across a list of ids — drives the stats chart.
   *  Index 0 is unseen; index b+1 holds the cards sitting in box b. */
  function distribution(ids) {
    const out = new Array(MAX_BOX + 2).fill(0);
    ids.forEach((id) => {
      const c = Store.card(id);
      out[c ? c.box + 1 : 0] += 1;
    });
    return out;
  }

  /** Axis label for a distribution bucket. */
  function boxLabel(i) {
    if (i === 0) return 'new';
    if (i === 1) return 'learn';
    return fmtInterval(BASE[i - 2]);
  }

  return {
    BASE, RATINGS, MAX_BOX, LEECH_AT, MASTERY_BOX,
    fresh, preview, rate, xpFor, isLeech, isMastered,
    fmtInterval, distribution, boxLabel
  };
})();
