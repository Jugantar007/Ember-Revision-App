/* notify.js — reminders.
 *
 * Two layers, because mobile web can't do what people assume it can:
 *
 *  1. LOCAL NUDGE (works day one, no setup). Fires when the app is open or the
 *     service worker happens to be alive. A PWA cannot reliably wake itself at
 *     20:00 tomorrow — browsers kill background timers. This layer is honest
 *     about that: it nudges when it can, nothing more.
 *
 *  2. WEB PUSH (reliable, still free). The phone subscribes once; the push
 *     endpoint is stored in the repo; a GitHub Actions cron posts to it on a
 *     schedule. That arrives even with the app closed and Chrome not running.
 *     Setup: see README → "Reminders".
 */

const Notify = (function () {
  let config = { vapidPublicKey: '' };
  let configLoaded = false;

  const supported = () =>
    'Notification' in window && 'serviceWorker' in navigator;

  const pushSupported = () =>
    supported() && 'PushManager' in window;

  const permission = () => (supported() ? Notification.permission : 'unsupported');

  async function loadConfig() {
    if (configLoaded) return config;
    try {
      const res = await fetch('./push-config.json', { cache: 'no-cache' });
      if (res.ok) config = await res.json();
    } catch (_) { /* not configured yet — local nudges still work */ }
    configLoaded = true;
    return config;
  }

  const isConfigured = () => !!(config.vapidPublicKey && config.vapidPublicKey.length > 20);

  async function requestPermission() {
    if (!supported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
      return await Notification.requestPermission();
    } catch (_) {
      return Notification.permission;
    }
  }

  /* --------------------------- local nudges ----------------------------- */

  const NUDGE_KEY = 'pyrev.lastNudge';

  function canNudgeToday() {
    try { return localStorage.getItem(NUDGE_KEY) !== Store.today(); }
    catch (_) { return false; }
  }

  function markNudged() {
    try { localStorage.setItem(NUDGE_KEY, Store.today()); } catch (_) {}
  }

  /** Show a "you're behind" notification, at most once a day, evening only. */
  async function maybeNudge() {
    if (!Store.settings.reminders) return false;
    if (permission() !== 'granted') return false;
    if (!canNudgeToday()) return false;

    const m = Session.mission();
    if (m.complete || m.nothingDue) return false;

    const hour = new Date().getHours();
    if (hour < 17) return false;              // only nag in the evening

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;

    const body = m.minutesLeft > 0
      ? `${m.minutesLeft} min of revision left today — ${m.cardsLeft} cards to go.`
      : `${m.cardsLeft} cards left to finish today's mission.`;

    reg.showNotification('Mission incomplete', {
      body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'pyrev-nudge',
      vibrate: [50, 40, 50],
      data: { url: './index.html#/study/due' }
    });
    markNudged();
    return true;
  }

  /** Fire a notification N minutes from now, only while this tab stays alive. */
  function scheduleSoftReminder(minutes) {
    const ms = Math.max(1, minutes) * 60000;
    setTimeout(async () => {
      if (!Store.settings.reminders || permission() !== 'granted') return;
      if (Session.mission().complete) return;
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      reg.showNotification('Revision break over', {
        body: 'Pick up where you left off.',
        icon: './icons/icon-192.png',
        tag: 'pyrev-soft',
        data: { url: './index.html#/study/due' }
      });
    }, ms);
  }

  /* ----------------------------- web push ------------------------------- */

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function currentSubscription() {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return reg.pushManager.getSubscription();
  }

  async function subscribe() {
    await loadConfig();
    if (!pushSupported()) throw new Error('Push not supported on this browser');
    if (!isConfigured()) throw new Error('No VAPID key in push-config.json yet');

    const perm = await requestPermission();
    if (perm !== 'granted') throw new Error('Notification permission denied');

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey)
      });
    }
    const json = sub.toJSON();
    Store.state.push.subscription = json;
    Store.state.push.enabledAt = new Date().toISOString();
    Store.flush();
    return json;
  }

  async function unsubscribe() {
    const sub = await currentSubscription();
    if (sub) await sub.unsubscribe();
    Store.state.push.subscription = null;
    Store.state.push.enabledAt = null;
    Store.flush();
  }

  /** Fire a notification right now, to prove the plumbing works. */
  async function testNotification() {
    const perm = await requestPermission();
    if (perm !== 'granted') throw new Error('Permission not granted');
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Ember test', {
      body: 'Notifications are working. This one came from your phone, not the server.',
      icon: './icons/icon-192.png',
      tag: 'pyrev-test',
      vibrate: [40, 30, 40],
      data: { url: './index.html#/home' }
    });
  }

  return {
    supported, pushSupported, permission, requestPermission,
    loadConfig, isConfigured, get config() { return config; },
    maybeNudge, scheduleSoftReminder,
    currentSubscription, subscribe, unsubscribe, testNotification
  };
})();
