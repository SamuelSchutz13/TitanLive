import { createHmac } from 'node:crypto';

const STUN = { urls: 'stun:stun.l.google.com:19302' };
const TTL_S = 6 * 60 * 60;

// coturn `use-auth-secret` (TURN REST API): username = expiry unix time, credential = base64(HMAC-SHA1(secret, username)).
export function iceServers(env = process.env, now = Date.now()) {
  const urls = env.TURN_URLS?.split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls?.length || !env.TURN_SECRET) return [STUN];
  const username = String(Math.floor(now / 1000) + TTL_S);
  const credential = createHmac('sha1', env.TURN_SECRET)
    .update(username)
    .digest('base64');
  return [STUN, { urls, username, credential }];
}
