/* Ember service worker
 * Strategy:
 *   - App shell (html/css/js/icons): cache-first, versioned. Bump SHELL_VERSION on code changes.
 *   - Content (data/*.json): network-first with cache fallback, so editing JSON on GitHub
 *     shows up on the next app open without touching SHELL_VERSION.
 *   - Push: shows revision reminders sent by the GitHub Actions cron job.
 */

const SHELL_VERSION = 'pyrev-shell-v4';
const DATA_CACHE = 'pyrev-data-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/store.js',
  './js/srs.js',
  './js/loader.js',
  './js/session.js',
  './js/notify.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== SHELL_VERSION && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isDataRequest(url) {
  return url.pathname.includes('/data/') && url.pathname.endsWith('.json');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Content: network-first so GitHub edits land immediately; fall back to cache offline.
  if (isDataRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // App shell: cache-first.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Navigation requests offline: serve the shell so the SPA can boot.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});

/* ---- Push notifications (sent by .github/workflows/reminder.yml) ---- */

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Ember',
    body: 'Time for a revision block.',
    url: './index.html#/study/due'
  };
  try {
    if (event.data) payload = Object.assign(payload, event.data.json());
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: payload.tag || 'pyrev-reminder',
      renotify: true,
      vibrate: [60, 40, 60],
      data: { url: payload.url },
      actions: [
        { action: 'study', title: 'Start now' },
        { action: 'later', title: 'Later' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'later') return;

  const target = (event.notification.data && event.notification.data.url) || './index.html#/study/due';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// Chrome can expire a subscription; ask the page to resubscribe next time it opens.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.showNotification('Ember reminders paused', {
      body: 'Open Ember and re-enable reminders in Settings.',
      icon: './icons/icon-192.png',
      tag: 'pyrev-resubscribe'
    })
  );
});
