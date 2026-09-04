import type { IncomingMessage, ServerResponse } from 'http';
import { handleVertexChat, handleVertexDiary } from './vertexHandler';

export function parseJsonBody<T = any>(req: IncomingMessage): Promise<T> {
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

export function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
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
