import type { IncomingMessage, ServerResponse } from 'http';
import { handleVertexChat, handleVertexDiary } from './vertexHandler';
import { VERTEX_PASSCODE } from '../constants';

export async function parseJsonBody<T = any>(req: IncomingMessage & { body?: any }): Promise<T> {
  // If the body is already parsed by Vercel or Express middleware
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') {
      return req.body as T;
    }
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {} as T;
      }
    }
  }

  // Fallback for raw stream (Vite local dev server / Node HTTP)
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Prevent oversized payloads (> 50MB)
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }, statusCode: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(data);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function isPasscodeValid(req: IncomingMessage & { body?: any }, payload?: any): boolean {
  const headerCode = req.headers['x-vertex-passcode'] || req.headers['x-passcode'];
  const bodyCode = payload?.passcode;
  return headerCode === VERTEX_PASSCODE || bodyCode === VERTEX_PASSCODE;
}

/**
 * Connect/Vite compatible middleware dispatcher for /api/gemini routes.
 */
export async function handleGeminiApiMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) {
  const url = req.url?.split('?')[0] || '';

  if (req.method === 'POST' && (url === '/api/gemini/generate' || url === '/api/gemini/chat')) {
    try {
      const payload = await parseJsonBody(req);
      if (!isPasscodeValid(req, payload)) {
        sendJson(res, 401, {
          error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
          code: "LOCKED"
        });
        return;
      }

      const result = await handleVertexChat(payload);
      if (result.ok) {
        sendJson(res, 200, { text: result.text });
      } else {
        sendJson(res, 500, { error: result.error });
      }
    } catch (err: any) {
      console.error('[API Error /generate]:', err);
      sendJson(res, 400, { error: err.message || 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/gemini/diary') {
    try {
      const payload = await parseJsonBody(req);
      if (!isPasscodeValid(req, payload)) {
        sendJson(res, 401, {
          error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
          code: "LOCKED"
        });
        return;
      }

      const result = await handleVertexDiary(payload);
      if (result.ok) {
        sendJson(res, 200, { text: result.text });
      } else {
        sendJson(res, 500, { error: result.error });
      }
    } catch (err: any) {
      console.error('[API Error /diary]:', err);
      sendJson(res, 400, { error: err.message || 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'GET' && url === '/api/gemini/status') {
    sendJson(res, 200, {
      status: 'online',
      provider: 'Vertex AI',
      project: process.env.VERTEX_PROJECT_ID || 'gen-lang-client-0100408368',
      region: process.env.VERTEX_LOCATION || 'global',
    });
    return;
  }

  next();
}
