<p align="center">
  <img src="assets/logo.png" alt="Ember — The Essence of a Recall" width="320">
</p>

# Ember

*The Essence of a Recall — made by J*

A spaced-repetition revision app for Python, OOP, DSA, ML and Edge AI interview prep.
No build step, no dependencies, no backend. Push to GitHub → the app on your phone updates.

- **191 cards** across 7 topics, each with a flashcard, a Q&A entry and an MCQ
- **SM-2 lite scheduler** — cards come back exactly when you're about to forget them
- **Daily mission, streaks, XP and challenges**
- **Works offline** once installed
- **Reminders** — local nudges day one, real scheduled push via GitHub Actions

---

## 1. Get it on GitHub

```bash
cd Revision-App
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Jugantar007/Revision-App.git
git push -u origin main
```

Then on github.com: **Settings → Pages → Build and deployment**
- Source: **Deploy from a branch**
- Branch: **main**, folder: **/ (root)**
- Save

A minute later the app is live at **https://jugantar007.github.io/Revision-App/**

> Keep the repo **public** if you want GitHub Actions reminders on the free tier — scheduled
> workflows on private repos consume Actions minutes from your quota.

## 2. Install on your Pixel 8 Pro

1. Open the Pages URL in **Chrome** on the phone
2. Menu (⋮) → **Add to Home screen** → **Install**
3. Launch it from the home screen — it opens fullscreen, no address bar

The layout is built for the Pixel 8 Pro's 448 × 997 CSS-px viewport: the warm pink-to-yellow wash
from the Ember logo with frosted white cards, all controls in the bottom thumb zone, and transform-only animations
so the 120 Hz panel stays smooth.

## 3. The update loop

| You do | What happens |
|---|---|
| Edit a file on github.com (works from the phone) | Pages redeploys in ~30-60s |
| Open the app | Service worker fetches `data/*.json` fresh — **new questions appear immediately** |
| Changed code (`js/`, `css/`, `index.html`) | Bump `SHELL_VERSION` in `sw.js`, then the app shows a **"New content available — Reload"** banner |

Content and code are cached differently on purpose. Question files are network-first, so adding
a flashcard needs no version bump and no reload prompt. Code is cache-first, so you only take the
reload hit when something structural actually changed.

Your progress lives in `localStorage` and survives every update.

## 4. Adding your own questions

Each topic is one file in `data/`. Add an object to `items` — nothing else to touch:

```json
{
  "id": "pyf-035",
  "type": "concept",
  "difficulty": 2,
  "tags": ["asyncio", "concurrency"],
  "q": "What does `await` actually do?",
  "a_short": "Yields control back to the event loop until the awaited coroutine completes.",
  "a_full": "Longer explanation shown under the short answer.",
  "code": "optional code shown WITH the question",
  "a_code": "optional code shown WITH the answer",
  "mcq": {
    "options": ["Blocks the thread", "Yields to the event loop", "Spawns a thread", "Nothing"],
    "correct": 1
  },
  "asked_at": ["Qualcomm"]
}
```

**Required:** `id` (unique across every file), `type`, `q`, `a_short`.
**Optional:** everything else. An item with `mcq` also shows up in quiz mode.

`type` is one of `concept`, `predict_output`, `coding`, `compare` — it only changes the label
on the card. `difficulty` 1-4 scales the XP. Backticks in `q`/`a_short`/`a_full` render as
inline code.

**To add a whole new topic:** create `data/my-topic.json` with the same `{"section", "version", "items"}`
shape, then add an entry to `data/index.json`.

Validate before pushing:

```bash
python3 scripts/validate.py
```

## 5. Reminders

### Layer 1 — local nudges (already working)

Turn on reminders in Settings and grant permission. The app notifies you in the evening if the
day's mission is incomplete. **Limitation:** this only fires when the app is open or the service
worker happens to be alive. A PWA cannot reliably wake itself at 8pm tomorrow — browsers kill
background timers. That's what layer 2 is for.

### Layer 2 — scheduled push (reliable, free)

**a. Generate a VAPID key pair** (once, on your laptop):

```bash
npx web-push generate-vapid-keys
```

**b. Put the public key in `push-config.json`**, commit and push:

```json
{ "vapidPublicKey": "BPx...your-public-key" }
```

**c. Add repo secrets** — GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key (same one as above) |
| `VAPID_PRIVATE_KEY` | the private key — never commit this |
| `VAPID_SUBJECT` | `mailto:your@email.com` |
| `PUSH_SUBSCRIPTION` | filled in at step (e) |

**d. Subscribe the phone:** open the app → Settings → Scheduled push → **Enable**.
A subscription JSON appears. Tap **Copy to clipboard**.

**e. Paste it** into the `PUSH_SUBSCRIPTION` secret.

**f. Test it:** Actions tab → *Revision reminders* → **Run workflow**. Your phone should buzz
within seconds.

Schedule is in `.github/workflows/reminder.yml` — currently 08:55 and 19:55 IST. Cron is in UTC,
so subtract 5:30. GitHub's scheduler is best-effort and can run late under load.

If notifications stop, the subscription probably expired (Chrome does this after long inactivity
or a storage clear). Re-enable in Settings and update the secret.

## 6. Local development

`fetch` is blocked on `file://`, so you need a server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Chrome DevTools → **Device toolbar** → add a custom device at **448 × 997, DPR 3** to see exactly
what the phone sees.

## 7. Backup

Progress is in browser storage, and clearing site data wipes it. **Settings → Download backup**
exports everything as JSON; **Restore from file** brings it back. Do it every few weeks.

## 8. How the scheduler works

Each card carries a `box` (rung on the interval ladder) and an `ease` (personal multiplier):

```
interval = BASE[box] × (ease / 2.5) × ratingMultiplier
BASE = [1, 3, 7, 16, 35, 90, 180] days
```

| Rating | box | ease | multiplier |
|---|---|---|---|
| Again | → 0 | −0.20 | due tomorrow |
| Hard | unchanged | −0.15 | ×0.65 |
| Good | +1 | — | ×1.00 |
| Easy | +2 | +0.15 | ×1.35 |

Ease is clamped to [1.3, 2.8]. A card failed 4+ times becomes a **leech** and surfaces in
Weak Spots. Cards at box ≥ 4 (35+ day interval) count as mastered.

Rate honestly. Rating Good on something you half-remembered pushes it 35 days out and you'll
have lost it by the interview.

## 9. File map

```
index.html                  app shell + bottom nav
assets/logo.png             the Ember logo (README banner)
icons/                      home-screen icons cut from the logo
manifest.webmanifest        PWA metadata, icons, shortcuts
sw.js                       offline cache, update detection, push handler
push-config.json            VAPID public key (edit this)
css/app.css                 design system, Pixel 8 Pro layout
js/store.js                 localStorage state, streaks, XP, backup
js/srs.js                   SM-2 lite scheduler
js/loader.js                content loading + queue building
js/session.js               study runs, clock, mission, challenges
js/notify.js                local nudges + web push subscription
js/app.js                   router, views, interaction
data/index.json             topic registry
data/*.json                 the question bank
scripts/send-reminder.js    cron push sender (runs in Actions)
scripts/validate.py         content linter
.github/workflows/          reminder schedule
```

## 10. Where to take it next

- Write the Edge AI deck out to 80+ cards — it's the differentiated one and it maps straight
  onto the interview you're actually preparing for
- Add an `asked_at` entry whenever a question comes up in a real interview
- Interview Simulation mode (`#/study/sim`) is wired up but unlinked in the UI — add a button
  on the home screen when you want it
