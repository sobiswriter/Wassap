import type { IncomingMessage, ServerResponse } from 'http';
import { 
  handleVertexImageSynthesis, 
  handleVertexImageGeneration, 
  handleVertexImageExcuse 
} from '../../server/vertexHandler';
import { VERTEX_PASSCODE } from '../../constants';

function parseJsonBody<T = any>(req: IncomingMessage & { body?: any }): Promise<T> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') {
      return Promise.resolve(req.body as T);
    }
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch {
        return Promise.resolve({} as T);
      }
    }
  }

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
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

function sendJson(res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }, statusCode: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(data);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function isPasscodeValid(req: IncomingMessage & { body?: any }, payload?: any): boolean {
  const headerCode = req.headers['x-vertex-passcode'] || req.headers['x-passcode'];
  const bodyCode = payload?.passcode;
  return headerCode === VERTEX_PASSCODE || bodyCode === VERTEX_PASSCODE;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await parseJsonBody(req);
    if (!isPasscodeValid(req, payload)) {
      sendJson(res, 401, {
        error: 'Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.',
        code: 'LOCKED',
      });
      return;
    }

    const action = (req as any).__action || payload.action || (req.url?.includes('synthesize') ? 'synthesize' : req.url?.includes('excuse') ? 'excuse' : 'generate');

    if (action === 'synthesize') {
      const result = await handleVertexImageSynthesis(payload);
      if (result.ok) {
        sendJson(res, 200, { result: result.result });
      } else {
        sendJson(res, 500, { error: result.error });
      }
      return;
    }

    if (action === 'excuse') {
      const result = await handleVertexImageExcuse(payload);
      if (result.ok) {
        sendJson(res, 200, { text: result.text });
      } else {
        sendJson(res, 500, { error: result.error });
      }
      return;
    }

    // Default: Image Generation
    const result = await handleVertexImageGeneration(payload);
    if (result.ok) {
      sendJson(res, 200, { imageData: result.imageData });
    } else {
      sendJson(res, 500, { error: result.error, blocked: result.blocked });
    }
  } catch (error: any) {
    console.error('[API Error /image]:', error);
    sendJson(res, 400, { error: error?.message || 'Invalid request body' });
  }
}
