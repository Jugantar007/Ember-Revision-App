/* session.js — the active study run, plus the daily mission / streak / quest layer.
 *
 * A "session" is one pass through a queue of items. It owns:
 *   - position in the queue and the per-run scoreboard
 *   - the study clock (only ticks while a study screen is open AND the app is visible,
 *     so leaving the phone on the desk doesn't inflate your minutes)
 *   - mission completion, which is what fires the streak + confetti
 */

const Session = (function () {
  const listeners = {};

  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, payload) { (listeners[evt] || []).forEach((fn) => fn(payload)); }

  let run = null;

  /* ------------------------------- clock -------------------------------- */

  let clockOn = false;
  let clockTimer = null;
  let secondsBuffer = 0;

  function tick() {
    if (!clockOn || document.visibilityState !== 'visible') return;
    secondsBuffer += 5;
    if (secondsBuffer >= 60) {
      const mins = Math.floor(secondsBuffer / 60);
      secondsBuffer -= mins * 60;
      Store.bumpDay({ minutes: mins });
      emit('tick', { minutes: Store.day().minutes });
      checkMission();
    }
  }

  function startClock() {
    if (clockOn) return;
    clockOn = true;
    clockTimer = setInterval(tick, 5000);
  }

  function stopClock() {
    clockOn = false;
    clearInterval(clockTimer);
    clockTimer = null;
    Store.flush();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Store.flush();
  });

  /* ------------------------------- run ---------------------------------- */

  function start(queue, meta) {
    run = {
      queue: queue.slice(),
      idx: 0,
      mode: (meta && meta.mode) || 'flash',
      section: (meta && meta.section) || null,
      title: (meta && meta.title) || 'Study',
      timed: (meta && meta.timed) || 0,         // seconds, 0 = untimed
      startedAt: Date.now(),
      right: 0,
      wrong: 0,
      xp: 0,
      answered: 0,
      again: []
    };
    startClock();
    return run;
  }

  const current = () => (run && run.idx < run.queue.length) ? run.queue[run.idx] : null;
  const remaining = () => run ? Math.max(0, run.queue.length - run.idx) : 0;
  const progress = () => run ? (run.queue.length ? run.idx / run.queue.length : 1) : 0;
  const active = () => run;
  const finished = () => !!run && run.idx >= run.queue.length;

  function haptic(ms) {
    if (!Store.settings.haptics) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) {} }
  }

  /** Record a flashcard rating and advance. */
  function answer(ratingId) {
    const item = current();
    if (!item) return null;

    const before = Store.card(item.id);
    const after = SRS.rate(item.id, ratingId);
    const xp = SRS.xpFor(before, ratingId, item.difficulty);

    if (!before) Store.bumpDay({ newSeen: 1 });
    Store.bumpDay({ cards: 1 });
    if (item.type === 'predict_output') Store.bumpDay({ predictCards: 1 });
    if (SRS.isLeech(before)) Store.bumpDay({ weakCards: 1 });
    Store.addXp(xp);

    run.answered += 1;
    run.xp += xp;
    if (ratingId === 0) { run.wrong += 1; run.again.push(item); }
    else run.right += 1;

    haptic(ratingId === 0 ? [30, 40, 30] : 18);

    run.idx += 1;
    emit('answered', { item, ratingId, xp, card: after });
    checkMission();
    return after;
  }

  /** Record an MCQ answer. Correct maps to Good, wrong maps to Again. */
  function answerMcq(chosenIdx) {
    const item = current();
    if (!item || !item.mcq) return null;
    const correct = chosenIdx === item.mcq.correct;
    const result = { correct, chosen: chosenIdx, answer: item.mcq.correct, item };
    emit('mcq', result);
    return result;
  }

  /** Re-queue the cards you failed, at the end of the run. */
  function requeueAgain() {
    if (!run || !run.again.length) return 0;
    const n = run.again.length;
    run.queue = run.queue.concat(run.again);
    run.again = [];
    return n;
  }

  function end() {
    stopClock();
    const summary = run ? Object.assign({}, run, {
      durationSec: Math.round((Date.now() - run.startedAt) / 1000)
    }) : null;
    run = null;
    return summary;
  }

  /* ------------------------------- mission ------------------------------ */

  /**
   * The card target adapts to what is actually answerable today.
   *
   * A fresh install has no due cards and only `newPerDay` unseen ones, so a
   * flat target of 40 would be unreachable on day one and the streak could
   * never start. `available` stays constant through the day: every card you
   * answer leaves the due/new pool and enters d.cards.
   */
  function todaysTarget() {
    const d = Store.day();
    const s = Store.settings;
    if (!Content.index) return s.dailyCards;
    const due = Content.dueItems().length;
    const newLeft = Math.max(0, s.newPerDay - (d.newSeen || 0));
    const available = due + newLeft + d.cards;
    if (available === 0) return 0;               // genuinely nothing to do today
    return Math.max(5, Math.min(s.dailyCards, available));
  }

  function mission() {
    const d = Store.day();
    const s = Store.settings;
    const target = todaysTarget();
    const cardPct = target > 0 ? Math.min(1, d.cards / target) : 0;
    const minPct = s.dailyMinutes ? Math.min(1, d.minutes / s.dailyMinutes) : 0;
    const pct = Math.max(cardPct, minPct);
    return {
      cards: d.cards,
      cardTarget: target,
      minutes: d.minutes,
      minuteTarget: s.dailyMinutes,
      minutesLeft: Math.max(0, s.dailyMinutes - d.minutes),
      cardsLeft: Math.max(0, target - d.cards),
      pct,
      nothingDue: target === 0,
      complete: d.done || (target > 0 && pct >= 1)
    };
  }

  function checkMission() {
    const m = mission();
    if (!m.complete) return false;
    const res = Store.markDayDone();
    if (res.changed) {
      Store.addXp(50);
      const streak = Store.liveStreak();
      if (streak >= 7) Store.awardBadge('streak-7');
      if (streak >= 30) Store.awardBadge('streak-30');
      haptic([40, 60, 40, 60, 80]);
      emit('mission-complete', { streak, xp: Store.state.xp });
    }
    evaluateQuests();
    return res.changed;
  }

  /* ------------------------------- quests ------------------------------- */

  // Quest 3 rotates by day so the daily set doesn't go stale.
  const ROTATING = [
    { id: 'predict-8', text: 'Trace 8 "predict the output" cards', xp: 35, test: (d) => (d.predictCards || 0) >= 8 },
    { id: 'quiz-80', text: 'Score 80%+ on any quiz', xp: 35, test: (d) => (d.quizBest || 0) >= 80 },
    { id: 'weak-5', text: 'Review 5 weak-spot cards', xp: 35, test: (d) => (d.weakCards || 0) >= 5 },
    { id: 'sim-run', text: 'Finish one interview simulation', xp: 40, test: (d) => (d.simRuns || 0) >= 1 },
    { id: 'cards-60', text: 'Answer 60 cards in a day', xp: 40, test: (d) => d.cards >= 60 }
  ];

  function dayIndex() {
    const [y, m, d] = Store.today().split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  function questList() {
    const d = Store.day();
    const dueLeft = Content.index ? Content.dueItems().length : 0;
    const rot = ROTATING[dayIndex() % ROTATING.length];
    return [
      {
        id: 'clear-due',
        text: 'Clear every due card',
        xp: 45,
        done: dueLeft === 0 && d.cards > 0
      },
      {
        id: 'cards-25',
        text: 'Answer 25 cards',
        xp: 25,
        done: d.cards >= 25
      },
      {
        id: rot.id,
        text: rot.text,
        xp: rot.xp,
        done: rot.test(d)
      }
    ];
  }

  function evaluateQuests() {
    const done = Store.questsToday();
    let awarded = 0;
    questList().forEach((q) => {
      if (q.done && !done[q.id]) {
        Store.completeQuest(q.id, q.xp);
        awarded += q.xp;
        emit('quest', q);
      }
    });
    return awarded;
  }

  /* ------------------------------- week view ---------------------------- */

  function weekDots() {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const key = Store.addDays(Store.today(), -i);
      const d = Store.state.days[key];
      if (!d) out.push({ key, level: 0 });
      else if (d.done) out.push({ key, level: 2 });
      else if (d.cards > 0) out.push({ key, level: 1 });
      else out.push({ key, level: 0 });
    }
    return out;
  }

  return {
    on, emit,
    start, current, remaining, progress, active, finished,
    answer, answerMcq, requeueAgain, end,
    startClock, stopClock,
    mission, todaysTarget, checkMission, questList, evaluateQuests, weekDots, haptic
  };
})();
