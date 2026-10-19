import { createHash, timingSafeEqual } from 'node:crypto';
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

function requestOriginAllowed(req: IncomingMessage): boolean {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean((req.socket as any)?.encrypted) || Boolean(process.env.VERCEL);
    return ['http:', 'https:'].includes(origin.protocol) && !origin.username && !origin.password
      && origin.host === req.headers.host && (!secure || origin.protocol === 'https:');
  } catch { return false; }
}

import type { IncomingMessage, ServerResponse } from 'http';

const DEFAULT_GCP_PROJECT = 'gen-lang-client-0100408368';
const DEFAULT_GCP_REGION = 'global';

function sendJson(res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }, statusCode: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(data);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!requestOriginAllowed(req)) {
    res.statusCode = 403; res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid origin' })); return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') { sendJson(res, 405, { error: 'Method not allowed' }); return; }
  if (!isPasscodeValid(req)) { sendJson(res, 200, { status: 'online', provider: 'Vertex AI (Built-in Server Credits)' }); return; }
  const project = process.env.VERTEX_PROJECT_ID || DEFAULT_GCP_PROJECT;
  const region = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_GCP_REGION;
  const clientEmail =
    process.env.GCP_CLIENT_EMAIL ||
    process.env.CLIENT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    process.env.VERTEX_CLIENT_EMAIL;

  const privateKey =
    process.env.GCP_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.VERTEX_PRIVATE_KEY;

  const hasServiceAccount = Boolean(
    process.env.GCP_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_CREDENTIALS ||
    (clientEmail && privateKey) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
  const hasServerApiKey = Boolean(process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY);

  sendJson(res, 200, {
    status: 'online',
    provider: 'Vertex AI (Built-in Server Credits)',
    project,
    region,
    hasCredentials: hasServiceAccount || hasServerApiKey,
    credentialsType: hasServiceAccount ? 'Service Account' : (hasServerApiKey ? 'API Key Fallback' : 'None / ADC'),
    platform: process.env.VERCEL ? 'Vercel Serverless' : 'Local / Custom Node',
    timestamp: new Date().toISOString()
  });
}
