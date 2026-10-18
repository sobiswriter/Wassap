import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

function isPasscodeValid(req: IncomingMessage & { body?: any }, payload?: any): boolean {
  let cookieCode: string | undefined;
  try {
    const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('wassap_vertex='));
    if (cookie) cookieCode = decodeURIComponent(cookie.slice('wassap_vertex='.length));
  } catch { return false; }
  const expected = process.env.VERTEX_PASSCODE
    ? createHash('sha256').update(process.env.VERTEX_PASSCODE).digest()
    : Buffer.from('065aa98a12229c668d822a2ef7e4cdc84fa1c0ec55671eae4560d50be441cdf5', 'hex');
  return [cookieCode, req.headers['x-vertex-passcode'], req.headers['x-passcode'], payload?.passcode]
    .some(code => typeof code === 'string' && code.length > 0 && code.length <= 1024
      && timingSafeEqual(createHash('sha256').update(code).digest(), expected));
}

export { isPasscodeValid };

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const reply = (status: number, data: object) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) { reply(403, { error: 'Invalid origin' }); return; }
    } catch { reply(403, { error: 'Invalid origin' }); return; }
  }
  const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean((req.socket as any)?.encrypted);
  const cookieFlags = `Path=/api/gemini; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `wassap_vertex=; Max-Age=0; ${cookieFlags}`);
    reply(200, { ok: true }); return;
  }
  if (req.method === 'GET') {
    const unlocked = isPasscodeValid(req);
    reply(unlocked ? 200 : 401, { ok: unlocked }); return;
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST, DELETE'); reply(405, { error: 'Method not allowed' }); return; }
  try {
    let body = req.body;
    if (body === undefined) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 8192) { reply(413, { error: 'Request too large' }); return; }
      }
      body = JSON.parse(raw || '{}');
    } else if (typeof body === 'string') body = JSON.parse(body);
    if (typeof body?.passcode !== 'string' || !isPasscodeValid({ headers: {} } as IncomingMessage, body)) {
      reply(401, { error: 'Incorrect password. Please try again.' }); return;
    }
    res.setHeader('Set-Cookie', `wassap_vertex=${encodeURIComponent(body.passcode)}; Max-Age=31536000; ${cookieFlags}`);
    reply(200, { ok: true });
  } catch { reply(400, { error: 'Invalid request body' }); }
}
