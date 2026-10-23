// Thin proxy to the Catchmail REST API (https://catchmail.io/docs).
// The browser calls the API directly first; this function is the fallback
// when the browser cannot reach it (CORS / network). Set CATCHMAIL_BASE in the
// Vercel project settings to point at a different base URL.
//
//   GET    /api/tempmail?action=mailbox&address=a@b.com[&page=1&page_size=50]
//   GET    /api/tempmail?action=message&id=ID&mailbox=a@b.com
//   DELETE /api/tempmail?action=message&id=ID&mailbox=a@b.com

const BASE = (process.env.CATCHMAIL_BASE || 'https://api.catchmail.io').replace(/\/+$/, '');
const TIMEOUT_MS = 8000;
const ADDRESS_RE = /^[a-z0-9._+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function fail(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const q = req.query || {};
  const action = q.action;
  const address = String(q.address || q.mailbox || '').trim().toLowerCase();
  if (!ADDRESS_RE.test(address)) return fail(res, 400, 'bad_request', 'A valid email address is required.');

  let url;
  let method = 'GET';

  if (action === 'mailbox') {
    if (req.method !== 'GET') return fail(res, 405, 'method_not_allowed', 'Method not allowed.');
    const page = clampInt(q.page, 1, 10000, 1);
    const pageSize = clampInt(q.page_size, 1, 100, 50);
    url = `${BASE}/api/v1/mailbox?address=${encodeURIComponent(address)}&page=${page}&page_size=${pageSize}`;
  } else if (action === 'message') {
    if (req.method !== 'GET' && req.method !== 'DELETE') return fail(res, 405, 'method_not_allowed', 'Method not allowed.');
    const id = String(q.id || '');
    if (!ID_RE.test(id)) return fail(res, 400, 'bad_request', 'A valid message ID is required.');
    method = req.method;
    url = `${BASE}/api/v1/message/${encodeURIComponent(id)}?mailbox=${encodeURIComponent(address)}`;
  } else {
    return fail(res, 400, 'bad_request', 'Unsupported action.');
  }

  try {
    const upstream = await fetch(url, {
      method,
      headers: { Accept: 'application/json', 'User-Agent': 'tempmail-vercel/2.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (upstream.status === 204) return res.status(204).end();
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(upstream.status).send(text);
  } catch (e) {
    return fail(res, 502, 'upstream_unreachable', 'Could not reach the mail service. Please try again.');
  }
};
