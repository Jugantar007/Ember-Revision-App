/* app.js — router, views, and wiring.
 *
 * Deliberately framework-free: no build step means you can edit a file on
 * github.com from your phone and the change is live on the next reload.
 * Views are template strings; interaction is one delegated click handler.
 */

(function () {
  const view = document.getElementById('view');
  const nav = document.getElementById('nav');
  const toastHost = document.getElementById('toast-host');

  /* ============================== helpers ================================ */

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /** Allow `backtick code` inside question/answer text. */
  function md(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code class="inline">$1</code>');
  }

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = msg;
    toastHost.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }, 2200);
  }

  function fmtMinutes(m) {
    if (m <= 0) return '0 min';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h && mm) return `${h} hr ${mm} min`;
    if (h) return `${h} hr`;
    return `${mm} min`;
  }

  function ring(pct, size) {
    const s = size || 86;
    const r = (s / 2) - 4.5;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(1, Math.max(0, pct)));
    return `<div class="ring-wrap">
      <svg class="ring" viewBox="0 0 ${s} ${s}" style="width:${s}px;height:${s}px">
        <circle class="track" cx="${s / 2}" cy="${s / 2}" r="${r}"></circle>
        <circle class="fill" cx="${s / 2}" cy="${s / 2}" r="${r}"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle>
      </svg>
      <span class="ring-label">${Math.round(pct * 100)}%</span>
    </div>`;
  }

  const ICONS = {
    back: '<svg viewBox="0 0 24 24"><path d="M15.4 5.6 14 4.2 6.2 12 14 19.8l1.4-1.4L9 12z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="m19 6.4-1.4-1.4-5.6 5.6L6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M8.6 5.6 10 4.2 17.8 12 10 19.8l-1.4-1.4L15 12z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M12 2s1.5 3.5-1 6.5C8.6 11.4 7 12.9 7 15.5A5 5 0 0 0 17 16c0-2-1-3.3-2-4.5-.6 1-1.4 1.6-2 1.6 1.5-3.4-1-8-1-11z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>'
  };

  const TYPE_LABEL = {
    concept: 'Concept',
    predict_output: 'Predict output',
    coding: 'Coding',
    compare: 'Compare'
  };

  function go(hash) { location.hash = hash; }

  /* ============================== confetti =============================== */

  const fx = document.getElementById('fx');
  const fxCtx = fx.getContext('2d');
  let particles = [];
  let fxRaf = null;

  function burst() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    fx.width = innerWidth * dpr;
    fx.height = innerHeight * dpr;
    fx.style.width = innerWidth + 'px';
    fx.style.height = innerHeight + 'px';
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.classList.add('on');

    const colors = ['#D4178A', '#FBD874', '#F58693', '#14804E', '#FFFFFF'];
    particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * 120,
        y: innerHeight * 0.42,
        vx: (Math.random() - 0.5) * 9,
        vy: -6 - Math.random() * 9,
        g: 0.26 + Math.random() * 0.14,
        w: 4 + Math.random() * 6,
        h: 6 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: colors[(Math.random() * colors.length) | 0],
        life: 1
      });
    }
    cancelAnimationFrame(fxRaf);
    stepFx();
  }

  function stepFx() {
    fxCtx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    particles.forEach((p) => {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.008;
      if (p.y < innerHeight + 40 && p.life > 0) {
        alive++;
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rot);
        fxCtx.globalAlpha = Math.max(0, p.life);
        fxCtx.fillStyle = p.c;
        fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fxCtx.restore();
      }
    });
    if (alive > 0) fxRaf = requestAnimationFrame(stepFx);
    else { fx.classList.remove('on'); fxCtx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  function missionCompleteOverlay(streak) {
    document.querySelectorAll('.scrim,.complete-card').forEach((n) => n.remove());
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const card = document.createElement('div');
    card.className = 'complete-card';
    card.innerHTML = `
      <div class="mark">🎯</div>
      <div class="h1" style="font-size:22px">Mission complete</div>
      <p class="sub" style="margin-top:6px">
        ${streak > 1 ? `${streak}-day streak. ` : ''}+50 XP banked.
      </p>
      <button class="btn btn-primary btn-block" data-act="dismiss-complete" style="margin-top:18px">Keep going</button>
      <button class="btn btn-ghost btn-block" data-act="dismiss-complete-home" style="margin-top:8px">Done for today</button>`;
    document.body.appendChild(scrim);
    document.body.appendChild(card);
    scrim.addEventListener('click', clearOverlay);
    burst();
  }

  function clearOverlay() {
    document.querySelectorAll('.scrim,.complete-card').forEach((n) => n.remove());
  }

  /* ============================== views ================================== */

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function viewHome() {
    const m = Session.mission();
    const streak = Store.liveStreak();
    const g = Content.globalStats();
    const lv = Store.level();
    const quests = Session.questList();
    const dots = Session.weekDots();

    const dueBySection = Content.sections
      .map((s) => ({ s, st: Content.sectionStats(s.id) }))
      .filter((x) => x.st.due > 0)
      .sort((a, b) => b.st.due - a.st.due)
      .slice(0, 3);

    const ctaLabel = m.nothingDue
      ? 'Study ahead anyway'
      : m.complete
        ? (g.due > 0 ? `Keep going — ${g.due} due` : 'Study ahead')
        : (g.due > 0 ? `Start mission — ${g.due} due` : 'Start mission');

    return `
      <div class="row-between" style="margin-bottom:16px">
        <div>
          <div class="eyebrow">${esc(greeting())}</div>
          <h1 class="h1">Today</h1>
        </div>
        ${streak > 0 ? `<div class="streak-chip">${ICONS.flame}${streak}</div>` : ''}
      </div>

      <div class="hero ${m.complete || m.nothingDue ? 'is-complete' : ''}">
        <div class="hero-top">
          ${ring(m.nothingDue ? 1 : m.pct)}
          <div class="hero-figures">
            ${m.nothingDue
              ? `<div class="hero-count" style="font-size:24px">All caught up</div>
                 <p class="sub" style="margin-top:4px">Nothing is due. Come back when cards mature.</p>`
              : `<div class="hero-count">${m.cards}<small> / ${m.cardTarget} cards</small></div>
                 <p class="sub" style="margin-top:4px">
                   ${m.complete ? 'Target hit. Anything more is a bonus.' : `${m.cardsLeft} cards to target`}
                 </p>`}
          </div>
        </div>
        <div class="timeleft">
          ${m.nothingDue
            ? `<span>Studied <b>${fmtMinutes(m.minutes)}</b> today</span>`
            : m.complete
              ? `<span>Studied <b>${fmtMinutes(m.minutes)}</b> today</span>`
              : `<span>⏳ <b>${fmtMinutes(m.minutesLeft)}</b> of revision left today</span>`}
        </div>
        <div class="week-dots">
          ${dots.map((d) => `<i class="week-dot ${d.level === 2 ? 'on' : d.level === 1 ? 'partial' : ''}"></i>`).join('')}
        </div>
      </div>

      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="go" data-to="#/study/due">
        ${ICONS.play}${esc(ctaLabel)}
      </button>

      <h2 class="h2" style="margin-top:26px">Daily challenges</h2>
      ${quests.map((q) => `
        <div class="quest ${q.done ? 'done' : ''}">
          <div class="quest-check">${ICONS.check}</div>
          <div class="grow">
            <div class="quest-text">${esc(q.text)}</div>
            <div class="quest-xp">+${q.xp} XP</div>
          </div>
        </div>`).join('')}

      ${dueBySection.length ? `
        <h2 class="h2" style="margin-top:26px">Due now</h2>
        <div class="list">
          ${dueBySection.map(({ s, st }) => `
            <button class="list-row" data-act="go" data-to="#/study/section/${esc(s.id)}">
              <span class="tile-icon" style="width:34px;height:34px;font-size:16px;border-radius:10px">${esc(s.icon)}</span>
              <span class="grow">
                <span style="display:block;font-size:14.5px;font-weight:600">${esc(s.title)}</span>
                <span class="tile-meta">${st.due} due · ${st.pct}% mastered</span>
              </span>
              ${ICONS.chev}
            </button>`).join('')}
        </div>` : ''}

      <h2 class="h2" style="margin-top:26px">Level ${lv.level}</h2>
      <div class="card card-tight">
        <div class="row-between" style="font-size:13px">
          <span class="dim">${Store.state.xp} XP</span>
          <span class="faint num">${lv.next - Store.state.xp} to level ${lv.level + 1}</span>
        </div>
        <div class="bar"><i style="transform:scaleX(${(lv.into / lv.span).toFixed(3)})"></i></div>
      </div>

      <div class="stat-grid" style="margin-top:12px">
        <div class="stat"><div class="v num">${g.seen}<span class="faint" style="font-size:14px">/${g.total}</span></div><div class="k">Cards started</div></div>
        <div class="stat"><div class="v num">${g.mastered}</div><div class="k">Mastered</div></div>
      </div>
      ${g.leeches > 0 ? `
        <button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="go" data-to="#/study/weak">
          ⚠️ ${g.leeches} weak spot${g.leeches > 1 ? 's' : ''} — drill them
        </button>` : ''}
    `;
  }

  function viewSections() {
    return `
      <h1 class="h1" style="margin-bottom:14px">Topics</h1>
      <input type="text" id="q" placeholder="Search all questions…"
        style="width:100%;margin-bottom:14px" data-act="noop" autocomplete="off">
      <div id="results"></div>
      <div id="tiles" class="stack">
        ${Content.sections.map((s) => {
          const st = Content.sectionStats(s.id);
          return `
          <a class="tile" href="#/section/${esc(s.id)}">
            <div class="tile-head">
              <div class="tile-icon">${esc(s.icon)}</div>
              <div class="grow">
                <div class="tile-title">${esc(s.title)}</div>
                <div class="tile-meta">${st.total} cards · ${st.mastered} mastered · ${st.pct}%</div>
              </div>
              ${st.due ? `<div class="tile-due">${st.due}</div>` : ''}
            </div>
            <div class="bar"><i style="transform:scaleX(${(st.pct / 100).toFixed(3)})"></i></div>
          </a>`;
        }).join('')}
      </div>`;
  }

  function viewSection(sid) {
    const s = Content.sections.find((x) => x.id === sid);
    if (!s) return `<div class="empty"><div class="big">🤔</div><p class="msg">Topic not found.</p></div>`;
    const st = Content.sectionStats(sid);
    const dist = SRS.distribution(Content.items(sid).map((i) => i.id));
    const max = Math.max(1, ...dist);
    const mcqCount = Content.items(sid).filter((i) => i.mcq).length;

    return `
      <div class="topbar">
        <button class="back" data-act="go" data-to="#/sections">${ICONS.back}</button>
        <div class="grow"><div class="eyebrow">Topic</div></div>
      </div>

      <div class="row" style="gap:14px;margin-bottom:16px">
        <div class="tile-icon" style="width:52px;height:52px;font-size:25px;border-radius:16px">${esc(s.icon)}</div>
        <div class="grow">
          <h1 class="h1" style="font-size:22px">${esc(s.title)}</h1>
          <p class="sub">${esc(s.blurb || '')}</p>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat"><div class="v num">${st.due}</div><div class="k">Due now</div></div>
        <div class="stat"><div class="v num">${st.total - st.seen}</div><div class="k">Not started</div></div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="row-between"><span class="h3" style="margin:0">Mastery</span><span class="num accent" style="font-weight:700">${st.pct}%</span></div>
        <div class="bar"><i style="transform:scaleX(${(st.pct / 100).toFixed(3)})"></i></div>
        <div class="boxes">
          ${dist.map((n, i) => `
            <div>
              <div class="b" style="height:${Math.round((n / max) * 54)}px;${i <= 1 ? 'background:var(--surface-3)' : ''}"></div>
              <div class="lbl">${SRS.boxLabel(i)}</div>
            </div>`).join('')}
        </div>
      </div>

      <h2 class="h2" style="margin-top:24px">Study modes</h2>
      <div class="stack-sm">
        <button class="btn btn-primary btn-block" data-act="go" data-to="#/study/section/${esc(sid)}">
          ${ICONS.play}Flashcards${st.due ? ` — ${st.due} due` : ''}
        </button>
        <button class="btn btn-block" data-act="go" data-to="#/quiz/${esc(sid)}" ${mcqCount < 4 ? 'disabled' : ''}>
          ✅ Quick quiz (${Math.min(10, mcqCount)} MCQs)
        </button>
        <button class="btn btn-block" data-act="go" data-to="#/browse/${esc(sid)}">
          📖 Browse all ${st.total} Q&amp;A
        </button>
      </div>
      ${st.leeches ? `<p class="sub" style="margin-top:14px">⚠️ ${st.leeches} card${st.leeches > 1 ? 's' : ''} in this topic keep slipping.</p>` : ''}
    `;
  }

  /* ----------------------------- study ---------------------------------- */

  let revealed = false;

  function cardBody(item, show) {
    const typeLabel = TYPE_LABEL[item.type] || 'Concept';
    return `
      <div class="flash-q">
        <div class="chip-row" style="margin-bottom:11px">
          <span class="chip chip-accent">${esc(item._sectionTitle)}</span>
          <span class="chip">${esc(typeLabel)}</span>
          ${(item.asked_at || []).slice(0, 2).map((c) => `<span class="chip chip-amber">${esc(c)}</span>`).join('')}
        </div>
        <div class="qtext">${md(item.q)}</div>
        ${item.code ? `<pre class="code">${esc(item.code)}</pre>` : ''}
      </div>
      ${show ? `
        <div class="flash-a">
          <div class="a-short">${md(item.a_short)}</div>
          ${item.a_full ? `<div class="a-full">${md(item.a_full)}</div>` : ''}
          ${item.a_code ? `<pre class="code">${esc(item.a_code)}</pre>` : ''}
          ${(item.tags || []).length ? `<div class="chip-row" style="margin-top:12px">${item.tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join('')}</div>` : ''}
        </div>` : ''}`;
  }

  function viewStudy() {
    const run = Session.active();
    if (!run) return viewStudyEmpty('Nothing queued.');
    if (Session.finished()) return viewStudySummary(run);

    const item = Session.current();
    const c = Store.card(item.id);
    const showIvl = Store.settings.showIntervals;

    return `
      <div class="study-head">
        <button class="back" data-act="end-study" style="margin-left:-8px">${ICONS.close}</button>
        <div class="progress-line"><i style="transform:scaleX(${Session.progress().toFixed(3)})"></i></div>
        <span class="faint num" style="font-size:12.5px;min-width:46px;text-align:right">${run.idx + 1}/${run.queue.length}</span>
      </div>

      <div class="flash">${cardBody(item, revealed)}</div>

      ${revealed ? `
        <div class="rating">
          ${SRS.RATINGS.map((r) => `
            <button class="rate" data-r="${r.id}" data-act="rate">
              <span>${r.label}</span>
              ${showIvl ? `<span class="ivl">${SRS.fmtInterval(SRS.preview(c, r.id))}</span>` : ''}
            </button>`).join('')}
        </div>`
      : `<button class="reveal-btn" data-act="reveal">Show answer</button>`}
    `;
  }

  function viewStudyEmpty(msg) {
    return `
      <div class="topbar"><button class="back" data-act="go" data-to="#/home">${ICONS.back}</button></div>
      <div class="empty">
        <div class="big">✨</div>
        <p class="msg">${esc(msg)}</p>
        <p class="sub" style="margin-top:8px">Nothing is due right now. Spaced repetition works by waiting — come back when cards mature, or start a new topic.</p>
        <button class="btn btn-primary" style="margin-top:20px" data-act="go" data-to="#/sections">Pick a topic</button>
      </div>`;
  }

  function viewStudySummary(run) {
    const acc = run.answered ? Math.round((run.right / run.answered) * 100) : 0;
    const mins = Math.max(1, Math.round(run.durationSec ? run.durationSec / 60 : (Date.now() - run.startedAt) / 60000));
    const againCount = run.again.length;
    return `
      <div class="topbar"><button class="back" data-act="go" data-to="#/home">${ICONS.back}</button></div>
      <div class="empty" style="padding-top:28px">
        <div class="big">${acc >= 80 ? '🔥' : acc >= 50 ? '👍' : '💪'}</div>
        <div class="h1" style="font-size:24px">Run complete</div>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="v num">${run.answered}</div><div class="k">Cards reviewed</div></div>
        <div class="stat"><div class="v num">${acc}%</div><div class="k">Recalled</div></div>
        <div class="stat"><div class="v num">+${run.xp}</div><div class="k">XP earned</div></div>
        <div class="stat"><div class="v num">${mins}</div><div class="k">Minutes</div></div>
      </div>
      <div class="stack-sm" style="margin-top:18px">
        ${againCount ? `<button class="btn btn-primary btn-block" data-act="requeue">Redo ${againCount} missed card${againCount > 1 ? 's' : ''}</button>` : ''}
        <button class="btn btn-block" data-act="go" data-to="#/study/due">Another round</button>
        <button class="btn btn-ghost btn-block" data-act="go" data-to="#/home">Back home</button>
      </div>`;
  }

  /* ----------------------------- quiz ----------------------------------- */

  let quiz = null;

  function viewQuiz() {
    if (!quiz) return viewStudyEmpty('No quiz loaded.');
    if (quiz.idx >= quiz.items.length) {
      const pct = Math.round((quiz.right / quiz.items.length) * 100);
      const prev = Store.day().quizBest || 0;
      if (pct > prev) { Store.bumpDay({ quizBest: pct }); Session.evaluateQuests(); }
      return `
        <div class="topbar"><button class="back" data-act="go" data-to="#/sections">${ICONS.back}</button></div>
        <div class="empty" style="padding-top:30px">
          <div class="big">${pct >= 80 ? '🏆' : pct >= 50 ? '📈' : '🧱'}</div>
          <div class="h1" style="font-size:30px">${pct}%</div>
          <p class="msg">${quiz.right} of ${quiz.items.length} correct</p>
        </div>
        ${quiz.missed.length ? `
          <h2 class="h2" style="margin-top:10px">Review the misses</h2>
          ${quiz.missed.map((it, i) => `
            <div class="qa open">
              <div class="qa-q"><span class="idx">${i + 1}</span><span>${md(it.q)}</span></div>
              <div class="qa-a"><div class="a-short">${md(it.a_short)}</div></div>
            </div>`).join('')}` : ''}
        <div class="stack-sm" style="margin-top:18px">
          <button class="btn btn-primary btn-block" data-act="go" data-to="#/quiz/${esc(quiz.sid)}">Retry</button>
          <button class="btn btn-ghost btn-block" data-act="go" data-to="#/section/${esc(quiz.sid)}">Back to topic</button>
        </div>`;
    }

    const it = quiz.items[quiz.idx];
    const answered = quiz.chosen !== null;
    const keys = ['A', 'B', 'C', 'D', 'E', 'F'];

    return `
      <div class="study-head">
        <button class="back" data-act="go" data-to="#/section/${esc(quiz.sid)}">${ICONS.close}</button>
        <div class="progress-line"><i style="transform:scaleX(${(quiz.idx / quiz.items.length).toFixed(3)})"></i></div>
        <span class="faint num" style="font-size:12.5px;min-width:46px;text-align:right">${quiz.idx + 1}/${quiz.items.length}</span>
      </div>
      <div class="flash-q">
        <div class="chip-row" style="margin-bottom:11px">
          <span class="chip chip-accent">${esc(it._sectionTitle)}</span>
          <span class="chip">${esc(TYPE_LABEL[it.type] || 'Concept')}</span>
        </div>
        <div class="qtext">${md(it.q)}</div>
        ${it.code ? `<pre class="code">${esc(it.code)}</pre>` : ''}
      </div>
      <div class="opts">
        ${it.mcq.options.map((o, i) => {
          let cls = '';
          if (answered) {
            if (i === it.mcq.correct) cls = 'correct';
            else if (i === quiz.chosen) cls = 'wrong';
            else cls = 'muted';
          }
          return `<button class="opt ${cls}" data-act="opt" data-i="${i}" ${answered ? 'disabled' : ''}>
            <span class="key">${keys[i]}</span><span>${md(o)}</span>
          </button>`;
        }).join('')}
      </div>
      ${answered ? `
        <div class="flash-a" style="margin-top:14px">
          <div class="a-short">${md(it.a_short)}</div>
          ${it.a_full ? `<div class="a-full">${md(it.a_full)}</div>` : ''}
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="quiz-next">
          ${quiz.idx + 1 >= quiz.items.length ? 'See score' : 'Next question'}
        </button>` : ''}`;
  }

  /* ----------------------------- browse --------------------------------- */

  function viewBrowse(sid) {
    const s = Content.sections.find((x) => x.id === sid);
    const list = Content.items(sid);
    if (!s) return viewStudyEmpty('Topic not found.');
    return `
      <div class="topbar">
        <button class="back" data-act="go" data-to="#/section/${esc(sid)}">${ICONS.back}</button>
        <div class="grow"><div class="eyebrow">Browse</div></div>
      </div>
      <h1 class="h1" style="font-size:21px;margin-bottom:4px">${esc(s.title)}</h1>
      <p class="sub" style="margin-bottom:16px">${list.length} questions · tap to reveal</p>
      ${list.map((it, i) => `
        <div class="qa" data-id="${esc(it.id)}">
          <button class="qa-q" data-act="toggle-qa">
            <span class="idx">${String(i + 1).padStart(2, '0')}</span>
            <span>${md(it.q)}</span>
          </button>
          <div class="qa-a">
            ${it.code ? `<pre class="code" style="margin-top:0">${esc(it.code)}</pre>` : ''}
            <div class="a-short">${md(it.a_short)}</div>
            ${it.a_full ? `<div style="margin-top:8px">${md(it.a_full)}</div>` : ''}
            ${it.a_code ? `<pre class="code">${esc(it.a_code)}</pre>` : ''}
          </div>
        </div>`).join('')}`;
  }

  /* ----------------------------- stats ---------------------------------- */

  function viewStats() {
    const g = Content.globalStats();
    const lv = Store.level();
    const streak = Store.liveStreak();
    const dist = SRS.distribution(Content.allIds());
    const max = Math.max(1, ...dist);

    // 28-day activity grid
    const cells = [];
    for (let i = 27; i >= 0; i--) {
      const key = Store.addDays(Store.today(), -i);
      const d = Store.state.days[key];
      const n = d ? d.cards : 0;
      const l = n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 45 ? 3 : 4;
      cells.push(`<i data-l="${l}" title="${key}: ${n} cards"></i>`);
    }

    const totalCards = Object.values(Store.state.days).reduce((a, d) => a + (d.cards || 0), 0);
    const totalMins = Object.values(Store.state.days).reduce((a, d) => a + (d.minutes || 0), 0);
    const daysDone = Object.values(Store.state.days).filter((d) => d.done).length;

    return `
      <h1 class="h1" style="margin-bottom:16px">Stats</h1>

      <div class="card">
        <div class="row-between">
          <div>
            <div class="eyebrow">Level ${lv.level}</div>
            <div class="h1" style="font-size:26px">${Store.state.xp} <span class="faint" style="font-size:14px;font-weight:500">XP</span></div>
          </div>
          ${streak > 0 ? `<div class="streak-chip">${ICONS.flame}${streak} day${streak > 1 ? 's' : ''}</div>` : ''}
        </div>
        <div class="bar"><i style="transform:scaleX(${(lv.into / lv.span).toFixed(3)})"></i></div>
      </div>

      <div class="stat-grid" style="margin-top:12px">
        <div class="stat"><div class="v num">${totalCards}</div><div class="k">Cards reviewed, all time</div></div>
        <div class="stat"><div class="v num">${Math.round(totalMins / 60 * 10) / 10}h</div><div class="k">Total study time</div></div>
        <div class="stat"><div class="v num">${daysDone}</div><div class="k">Missions completed</div></div>
        <div class="stat"><div class="v num">${Store.state.streak.best}</div><div class="k">Best streak</div></div>
      </div>

      <h2 class="h2" style="margin-top:24px">Last 4 weeks</h2>
      <div class="card card-tight"><div class="heat">${cells.join('')}</div></div>

      <h2 class="h2" style="margin-top:24px">Card maturity</h2>
      <div class="card card-tight">
        <div class="boxes" style="height:84px">
          ${dist.map((n, i) => `
            <div>
              <div class="b" style="height:${Math.round((n / max) * 66)}px;${i <= 1 ? 'background:var(--surface-3)' : ''}"></div>
              <div class="lbl">${SRS.boxLabel(i)}</div>
            </div>`).join('')}
        </div>
        <p class="sub" style="margin-top:12px;font-size:12.5px">
          Bars to the right are cards you'll see again in months — that's the goal.
          ${g.leeches ? `<span class="amber"> ${g.leeches} leech${g.leeches > 1 ? 'es' : ''} need work.</span>` : ''}
        </p>
      </div>

      <h2 class="h2" style="margin-top:24px">By topic</h2>
      <div class="list">
        ${Content.sections.map((s) => {
          const st = Content.sectionStats(s.id);
          return `<a class="list-row" href="#/section/${esc(s.id)}">
            <span class="grow">
              <span style="display:block;font-size:14px;font-weight:580">${esc(s.icon)} ${esc(s.title)}</span>
              <span class="bar" style="margin-top:8px"><i style="transform:scaleX(${(st.pct / 100).toFixed(3)})"></i></span>
            </span>
            <span class="num faint" style="font-size:13px;min-width:38px;text-align:right">${st.pct}%</span>
          </a>`;
        }).join('')}
      </div>

      ${g.leeches ? `<button class="btn btn-ghost btn-block" style="margin-top:14px" data-act="go" data-to="#/study/weak">Drill ${g.leeches} weak spots</button>` : ''}
    `;
  }

  /* ----------------------------- settings ------------------------------- */

  function viewSettings() {
    const s = Store.settings;
    const perm = Notify.permission();
    const sub = Store.state.push.subscription;
    const g = Content.globalStats();

    return `
      <h1 class="h1" style="margin-bottom:16px">Settings</h1>

      <h2 class="h2">Daily mission</h2>
      <div class="card">
        <div class="field">
          <div class="grow">
            <div class="field-label">Card target</div>
            <div class="field-help">A ceiling, not a quota — the daily target drops to whatever is actually due so the mission stays reachable. Today: ${Session.todaysTarget() || 'nothing due'}.</div>
          </div>
          <div class="stepper">
            <button data-act="step" data-k="dailyCards" data-d="-5">−</button>
            <span class="val num">${s.dailyCards}</span>
            <button data-act="step" data-k="dailyCards" data-d="5">+</button>
          </div>
        </div>
        <div class="field">
          <div class="grow">
            <div class="field-label">Minutes target</div>
            <div class="field-help">Clock only runs while a study screen is open.</div>
          </div>
          <div class="stepper">
            <button data-act="step" data-k="dailyMinutes" data-d="-15">−</button>
            <span class="val num">${s.dailyMinutes}</span>
            <button data-act="step" data-k="dailyMinutes" data-d="15">+</button>
          </div>
        </div>
        <div class="field">
          <div class="grow">
            <div class="field-label">New cards per day</div>
            <div class="field-help">Caps how fast unseen cards enter rotation. ${g.newLeft} still unseen.</div>
          </div>
          <div class="stepper">
            <button data-act="step" data-k="newPerDay" data-d="-4">−</button>
            <span class="val num">${s.newPerDay}</span>
            <button data-act="step" data-k="newPerDay" data-d="4">+</button>
          </div>
        </div>
      </div>

      <h2 class="h2" style="margin-top:24px">Reminders</h2>
      <div class="card">
        <div class="field">
          <div class="grow">
            <div class="field-label">Reminders on</div>
            <div class="field-help">Permission: <b>${esc(perm)}</b></div>
          </div>
          <button class="switch ${s.reminders ? 'on' : ''}" data-act="toggle" data-k="reminders"></button>
        </div>
        <div class="field">
          <div class="grow">
            <div class="field-label">Test a notification</div>
            <div class="field-help">Fires immediately from your phone.</div>
          </div>
          <button class="btn btn-sm" data-act="notify-test">Send</button>
        </div>
        <div class="field">
          <div class="grow">
            <div class="field-label">Scheduled push</div>
            <div class="field-help">
              ${Notify.isConfigured()
                ? (sub ? 'Subscribed. The GitHub Actions cron can reach this phone.' : 'Not subscribed yet on this device.')
                : 'Add a VAPID key to <code class="inline">push-config.json</code> first — see README.'}
            </div>
          </div>
          <button class="btn btn-sm" data-act="${sub ? 'push-off' : 'push-on'}" ${Notify.isConfigured() ? '' : 'disabled'}>
            ${sub ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
      ${sub ? `
        <div class="card" style="margin-top:10px">
          <div class="field-label" style="margin-bottom:6px">Subscription JSON</div>
          <div class="field-help" style="margin-bottom:8px">Paste this into the <code class="inline">PUSH_SUBSCRIPTION</code> repo secret on GitHub.</div>
          <textarea rows="5" readonly id="subjson">${esc(JSON.stringify(sub))}</textarea>
          <button class="btn btn-sm btn-block" style="margin-top:8px" data-act="copy-sub">Copy to clipboard</button>
        </div>` : ''}

      <h2 class="h2" style="margin-top:24px">Behaviour</h2>
      <div class="card">
        <div class="field">
          <div class="grow">
            <div class="field-label">Haptics</div>
            <div class="field-help">Short buzz on rating and mission complete.</div>
          </div>
          <button class="switch ${s.haptics ? 'on' : ''}" data-act="toggle" data-k="haptics"></button>
        </div>
        <div class="field">
          <div class="grow">
            <div class="field-label">Show next interval</div>
            <div class="field-help">Prints "3d / 7d / 16d" on the rating buttons.</div>
          </div>
          <button class="switch ${s.showIntervals ? 'on' : ''}" data-act="toggle" data-k="showIntervals"></button>
        </div>
      </div>

      <h2 class="h2" style="margin-top:24px">Backup</h2>
      <div class="card">
        <p class="field-help" style="margin:0 0 12px">
          Progress lives in this browser's storage. Clearing site data wipes it —
          export every few weeks and keep the file somewhere safe.
        </p>
        <div class="stack-sm">
          <button class="btn btn-block btn-sm" data-act="export">Download backup</button>
          <button class="btn btn-block btn-sm" data-act="import">Restore from file</button>
          <input type="file" id="importfile" accept="application/json" hidden>
        </div>
      </div>

      <h2 class="h2" style="margin-top:24px">Danger zone</h2>
      <div class="card">
        <div class="stack-sm">
          <button class="btn btn-block btn-sm" data-act="reset-progress" style="color:var(--r-hard)">Reset all progress</button>
          <button class="btn btn-block btn-sm" data-act="reset-all" style="color:var(--r-again)">Wipe everything</button>
        </div>
      </div>

      <p class="sub" style="margin-top:22px;text-align:center;font-size:12px">
        Ember · made by J · content v${Content.index ? Content.index.version : '?'} · ${g.total} cards
      </p>`;
  }

  /* ----------------------------- search --------------------------------- */

  function renderSearch(q) {
    const box = document.getElementById('results');
    const tiles = document.getElementById('tiles');
    if (!box) return;
    const hits = Content.search(q);
    if (!q || q.trim().length < 2) {
      box.innerHTML = '';
      if (tiles) tiles.style.display = '';
      return;
    }
    if (tiles) tiles.style.display = 'none';
    if (!hits.length) {
      box.innerHTML = `<div class="empty"><div class="big">🔍</div><p class="msg">No matches for "${esc(q)}"</p></div>`;
      return;
    }
    box.innerHTML = `<p class="sub" style="margin-bottom:10px">${hits.length} match${hits.length > 1 ? 'es' : ''}</p>` +
      hits.map((it, i) => `
        <div class="qa" data-id="${esc(it.id)}">
          <button class="qa-q" data-act="toggle-qa">
            <span class="idx">${String(i + 1).padStart(2, '0')}</span>
            <span>${md(it.q)}<br><span class="chip chip-accent" style="margin-top:6px">${esc(it._sectionTitle)}</span></span>
          </button>
          <div class="qa-a">
            ${it.code ? `<pre class="code" style="margin-top:0">${esc(it.code)}</pre>` : ''}
            <div class="a-short">${md(it.a_short)}</div>
            ${it.a_full ? `<div style="margin-top:8px">${md(it.a_full)}</div>` : ''}
          </div>
        </div>`).join('');
  }

  /* ============================== router ================================= */

  function setNavActive(route) {
    nav.querySelectorAll('.nav-item').forEach((a) => {
      a.classList.toggle('is-active', a.dataset.route === route);
    });
  }

  function render() {
    const hash = location.hash.replace(/^#\/?/, '') || 'home';
    const parts = hash.split('/');
    const root = parts[0];

    clearOverlay();
    view.className = 'view';
    nav.hidden = false;

    let html = '';
    let navKey = root;

    switch (root) {
      case 'home':
        html = viewHome();
        break;

      case 'sections':
        html = viewSections();
        break;

      case 'section':
        html = viewSection(parts[1]);
        navKey = 'sections';
        break;

      case 'browse':
        html = viewBrowse(parts[1]);
        navKey = 'sections';
        break;

      case 'study': {
        view.className = 'view view-study';
        nav.hidden = true;
        // Start a run only when arriving fresh, not on re-render.
        if (!Session.active() || Session.active()._route !== hash) {
          startRunFor(parts);
        }
        html = viewStudy();
        navKey = 'study';
        break;
      }

      case 'quiz':
        view.className = 'view view-study';
        nav.hidden = true;
        if (!quiz || quiz.sid !== parts[1] || quiz.done) startQuiz(parts[1]);
        html = viewQuiz();
        navKey = 'sections';
        break;

      case 'stats':
        html = viewStats();
        break;

      case 'settings':
        html = viewSettings();
        break;

      default:
        html = viewHome();
        navKey = 'home';
    }

    view.innerHTML = html;
    setNavActive(navKey);
    if (root !== 'study' && root !== 'quiz') window.scrollTo(0, 0);

    const qbox = document.getElementById('q');
    if (qbox) {
      qbox.addEventListener('input', (e) => renderSearch(e.target.value));
    }
    const file = document.getElementById('importfile');
    if (file) file.addEventListener('change', handleImport);
  }

  function startRunFor(parts) {
    const kind = parts[1];
    let queue = [];
    let meta = { mode: 'flash' };

    if (kind === 'section') {
      const sid = parts[2];
      queue = Content.buildQueue({ section: sid, limit: 60, includeNew: true });
      meta.section = sid;
    } else if (kind === 'weak') {
      queue = Content.weakItems().slice(0, 30);
      meta.mode = 'weak';
    } else if (kind === 'sim') {
      queue = Content.simQueue(20);
      meta.mode = 'sim';
      Store.bumpDay({ simRuns: 1 });
    } else {
      queue = Content.buildQueue({ limit: Math.max(20, Store.settings.dailyCards), includeNew: true });
    }

    revealed = false;
    // Clear any previous run first, or an empty queue would leave the old
    // session's cards on screen instead of the empty state.
    if (Session.active()) Session.end();
    if (!queue.length) { Session.stopClock(); return; }
    const run = Session.start(queue, meta);
    run._route = location.hash.replace(/^#\/?/, '');
  }

  function startQuiz(sid) {
    const items = Content.quizQueue(sid, 10);
    quiz = { sid, items, idx: 0, right: 0, chosen: null, missed: [], done: false };
  }

  /* ============================== actions ================================ */

  document.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;

    switch (act) {
      case 'go':
        go(t.dataset.to);
        break;

      case 'reveal':
        revealed = true;
        render();
        break;

      case 'rate': {
        Session.answer(Number(t.dataset.r));
        revealed = false;
        if (Session.finished()) {
          // end() stops the study clock — don't leave it ticking on the summary.
          const summary = Session.end();
          lastSummary = summary;
          renderSummary(summary);
        } else {
          render();
        }
        break;
      }

      case 'end-study': {
        const s = Session.end();
        lastSummary = s;
        if (s && s.answered > 0) renderSummary(s);
        else go('#/home');
        break;
      }

      case 'requeue': {
        if (!lastSummary || !lastSummary.again.length) break;
        const again = lastSummary.again.slice();
        revealed = false;
        const run = Session.start(again, { mode: 'again' });
        run._route = 'study/due';
        location.hash = '#/study/due';
        render();
        break;
      }

      case 'toggle-qa':
        t.closest('.qa').classList.toggle('open');
        break;

      case 'opt': {
        if (quiz.chosen !== null) break;
        const i = Number(t.dataset.i);
        quiz.chosen = i;
        const it = quiz.items[quiz.idx];
        if (i === it.mcq.correct) { quiz.right++; Session.haptic(18); }
        else { quiz.missed.push(it); Session.haptic([30, 40, 30]); }
        render();
        break;
      }

      case 'quiz-next':
        quiz.idx += 1;
        quiz.chosen = null;
        render();
        break;

      case 'step': {
        const k = t.dataset.k;
        const d = Number(t.dataset.d);
        const lo = k === 'dailyMinutes' ? 15 : k === 'newPerDay' ? 0 : 5;
        const hi = k === 'dailyMinutes' ? 240 : k === 'newPerDay' ? 60 : 200;
        Store.settings[k] = Math.min(hi, Math.max(lo, Store.settings[k] + d));
        Store.flush();
        render();
        break;
      }

      case 'toggle': {
        const k = t.dataset.k;
        Store.settings[k] = !Store.settings[k];
        Store.flush();
        if (k === 'reminders' && Store.settings[k]) Notify.requestPermission().then(render);
        else render();
        break;
      }

      case 'notify-test':
        Notify.testNotification()
          .then(() => toast('Notification sent', 'accent'))
          .catch((err) => toast(err.message));
        break;

      case 'push-on':
        Notify.subscribe()
          .then(() => { toast('Subscribed on this device', 'accent'); render(); })
          .catch((err) => toast(err.message));
        break;

      case 'push-off':
        Notify.unsubscribe().then(() => { toast('Push disabled'); render(); });
        break;

      case 'copy-sub': {
        const ta = document.getElementById('subjson');
        navigator.clipboard.writeText(ta.value)
          .then(() => toast('Copied', 'accent'))
          .catch(() => { ta.select(); toast('Select and copy manually'); });
        break;
      }

      case 'export': {
        const blob = new Blob([Store.exportJson()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ember-backup-${Store.today()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('Backup downloaded', 'accent');
        break;
      }

      case 'import':
        document.getElementById('importfile').click();
        break;

      case 'reset-progress':
        if (confirm('Reset all card progress, streaks and XP? Settings are kept.')) {
          Store.reset('progress');
          toast('Progress reset');
          go('#/home');
          render();
        }
        break;

      case 'reset-all':
        if (confirm('Wipe absolutely everything, settings included?')) {
          Store.reset();
          toast('Everything wiped');
          go('#/home');
          render();
        }
        break;

      case 'dismiss-complete':
        clearOverlay();
        break;

      case 'dismiss-complete-home':
        clearOverlay();
        Session.end();
        go('#/home');
        break;

      default:
        break;
    }
  });

  let lastSummary = null;

  function renderSummary(summary) {
    view.className = 'view';
    nav.hidden = false;
    view.innerHTML = viewStudySummary(summary || { answered: 0, right: 0, xp: 0, again: [], startedAt: Date.now() });
    setNavActive('home');
    window.scrollTo(0, 0);
  }

  function handleImport(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJson(reader.result);
        toast('Backup restored', 'accent');
        render();
      } catch (err) {
        toast('Invalid backup file');
      }
    };
    reader.readAsText(f);
  }

  /* ============================== boot =================================== */

  Session.on('mission-complete', (d) => {
    missionCompleteOverlay(d.streak);
  });

  Session.on('quest', (q) => {
    toast(`Challenge done: ${q.text} (+${q.xp} XP)`, 'accent');
  });

  window.addEventListener('hashchange', render);

  // Re-check the mission + nudge whenever the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Content.index) {
      Notify.maybeNudge();
      if (!location.hash.startsWith('#/study') && !location.hash.startsWith('#/quiz')) render();
    }
  });

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      // New version waiting → offer a reload instead of swapping under their feet.
      function offer(worker) {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(worker);
          }
        });
      }
      if (reg.waiting) showUpdateBanner(reg.waiting);
      reg.addEventListener('updatefound', () => offer(reg.installing));
      // Check for a new deploy each time the app opens.
      reg.update().catch(() => {});
    }).catch((e) => console.warn('[sw] registration failed', e));
  }

  function showUpdateBanner(worker) {
    const banner = document.getElementById('update-banner');
    banner.hidden = false;
    document.getElementById('update-reload').onclick = () => {
      if (worker) worker.postMessage('SKIP_WAITING');
      setTimeout(() => location.reload(), 120);
    };
  }

  let reloadingForSW = false;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForSW) return;
      reloadingForSW = true;
      location.reload();
    });
  }

  async function boot() {
    try {
      await Content.ready();
    } catch (e) {
      view.innerHTML = `
        <div class="empty">
          <div class="big">📡</div>
          <p class="msg">Couldn't load the question bank.</p>
          <p class="sub" style="margin-top:10px">${esc(e.message)}</p>
          <p class="sub" style="margin-top:14px">
            Opening <code class="inline">index.html</code> straight from the filesystem won't work —
            browsers block <code class="inline">fetch</code> on <code class="inline">file://</code>.
            Serve it over HTTP (GitHub Pages, or <code class="inline">python3 -m http.server</code>).
          </p>
        </div>`;
      nav.hidden = true;
      return;
    }

    await Notify.loadConfig();

    // Content version change → let the user know new material arrived.
    try {
      const seen = localStorage.getItem('pyrev.contentVersion');
      const now = String(Content.index.version);
      if (seen && seen !== now) toast('New questions added', 'accent');
      localStorage.setItem('pyrev.contentVersion', now);
    } catch (_) {}

    if (!location.hash) location.hash = '#/home';
    render();
    registerSW();
    Notify.maybeNudge();
  }

  boot();
})();
