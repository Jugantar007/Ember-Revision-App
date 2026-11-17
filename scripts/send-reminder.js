#!/usr/bin/env node
/**
 * send-reminder.js — pushes a revision reminder to the subscribed phone.
 *
 * Run by .github/workflows/reminder.yml on a cron schedule. Everything
 * sensitive comes from repo secrets; nothing is stored in the repo.
 *
 * Required env:
 *   VAPID_PUBLIC_KEY    the same public key that sits in push-config.json
 *   VAPID_PRIVATE_KEY   secret, pairs with the public key
 *   VAPID_SUBJECT       mailto:you@example.com  (required by the spec)
 *   PUSH_SUBSCRIPTION   the JSON blob copied from the app's Settings screen
 * Optional env:
 *   SLOT                "morning" | "evening" — picks the message tone
 */

const webpush = require('web-push');

const {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:nobody@example.com',
  PUSH_SUBSCRIPTION,
  SLOT = 'evening'
} = process.env;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!VAPID_PUBLIC_KEY) fail('VAPID_PUBLIC_KEY secret is not set');
if (!VAPID_PRIVATE_KEY) fail('VAPID_PRIVATE_KEY secret is not set');
if (!PUSH_SUBSCRIPTION) fail('PUSH_SUBSCRIPTION secret is not set — enable push in the app Settings and copy the JSON');

let subscription;
try {
  subscription = JSON.parse(PUSH_SUBSCRIPTION);
} catch (e) {
  fail('PUSH_SUBSCRIPTION is not valid JSON');
}
if (!subscription.endpoint) fail('PUSH_SUBSCRIPTION has no endpoint field');

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// The server has no idea how many cards are due — progress lives in the
// phone's localStorage. So the copy stays generic and the app fills in detail.
const MESSAGES = {
  morning: [
    'Morning block: clear your due cards before the day starts.',
    "Today's queue is waiting. 20 minutes now beats an hour tonight.",
    'Spaced repetition only works if you show up. Start the mission.',
    'First block of the day — due cards are ready.'
  ],
  evening: [
    'Mission still open. Finish the day with a clean queue.',
    'Streak check: have you hit your target today?',
    "Evening block — don't let the streak break on a Tuesday.",
    'Due cards are piling up. Fifteen minutes clears most of it.'
  ]
};

const pool = MESSAGES[SLOT] || MESSAGES.evening;
const body = pool[Math.floor(Math.random() * pool.length)];

const payload = JSON.stringify({
  title: SLOT === 'morning' ? 'Ember — morning block' : 'Ember — revision time',
  body,
  tag: `pyrev-${SLOT}`,
  url: './index.html#/study/due'
});

webpush
  .sendNotification(subscription, payload, { TTL: 3 * 60 * 60 })
  .then((res) => {
    console.log(`✓ pushed (${SLOT}) — status ${res.statusCode}`);
  })
  .catch((err) => {
    // 404/410 means the browser dropped the subscription (app uninstalled,
    // storage cleared, or the endpoint expired). Re-enable push in Settings
    // and update the PUSH_SUBSCRIPTION secret.
    if (err.statusCode === 404 || err.statusCode === 410) {
      fail('Subscription is gone (404/410). Re-enable push in the app and update the PUSH_SUBSCRIPTION secret.');
    }
    fail(`push failed: ${err.statusCode || ''} ${err.body || err.message}`);
  });
