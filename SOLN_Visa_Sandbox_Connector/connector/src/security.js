import crypto from 'node:crypto';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const replayCache = new Map();

export function canonicalRequest(timestamp, nonce, method, path, bodyText) {
  const bodyHash = crypto.createHash('sha256').update(bodyText || '').digest('hex');
  return [timestamp, nonce, method.toUpperCase(), path, bodyHash].join('\n');
}

export function signRequest(secret, canonical) {
  return crypto.createHmac('sha256', secret).update(canonical).digest('base64url');
}

export function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifySolnRequest(req) {
  const secret = process.env.SOLN_CONNECTOR_SHARED_SECRET;
  if (!secret || secret.length < 32) throw new Error('Connector shared secret is not configured safely');

  const timestamp = req.get('X-SOLN-Timestamp');
  const nonce = req.get('X-SOLN-Nonce');
  const signature = req.get('X-SOLN-Signature');
  if (!timestamp || !nonce || !signature) throw new Error('Missing SOLN authentication headers');

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
    throw new Error('Expired or invalid SOLN request timestamp');
  }

  purgeReplayCache();
  if (replayCache.has(nonce)) throw new Error('Replay detected');

  const bodyText = req.rawBody || '';
  const canonical = canonicalRequest(timestamp, nonce, req.method, req.originalUrl, bodyText);
  const expected = signRequest(secret, canonical);
  if (!safeEqual(signature, expected)) throw new Error('Invalid SOLN request signature');
  replayCache.set(nonce, Date.now());
}

function purgeReplayCache() {
  const cutoff = Date.now() - MAX_CLOCK_SKEW_MS;
  for (const [nonce, created] of replayCache.entries()) {
    if (created < cutoff) replayCache.delete(nonce);
  }
}

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  const blocked = /account|address|phone|email|name|credential|password|secret|token|certificate|private/i;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blocked.test(key) ? '[REDACTED]' : redact(item)]));
}
