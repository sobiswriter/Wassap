import type { IncomingMessage, ServerResponse } from 'http';
import { 
  handleVertexChat, 
  handleVertexDiary, 
  handleVertexTTS, 
  handleVertexImageSynthesis, 
  handleVertexImageGeneration, 
  handleVertexImageExcuse 
} from './vertexHandler';
import { VERTEX_PASSCODE, GCP_CONFIG } from '../constants';

export async function parseJsonBody<T = any>(req: IncomingMessage & { body?: any }): Promise<T> {
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

  if (req.method === 'POST' && url === '/api/gemini/tts') {
    try {
      const payload = await parseJsonBody(req);
      if (!isPasscodeValid(req, payload)) {
        sendJson(res, 401, {
          error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
          code: "LOCKED"
        });
        return;
      }

      const result = await handleVertexTTS(payload);
      if (result.ok) {
        sendJson(res, 200, { audioData: result.audioData, mimeType: result.mimeType });
      } else {
        sendJson(res, 500, { error: result.error });
      }
    } catch (err: any) {
      console.error('[API Error /tts]:', err);
      sendJson(res, 400, { error: err.message || 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/gemini/image-synthesize') {
    try {
      const payload = await parseJsonBody(req);
      if (!isPasscodeValid(req, payload)) {
        sendJson(res, 401, {
          error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
          code: "LOCKED"
        });
        return;
      }

      const result = await handleVertexImageSynthesis(payload);
      if (result.ok) {
        sendJson(res, 200, { result: result.result });
      } else {
        sendJson(res, 500, { error: result.error });
      }
    } catch (err: any) {
      console.error('[API Error /image-synthesize]:', err);
      sendJson(res, 400, { error: err.message || 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/gemini/image-generate') {
    try {
      const payload = await parseJsonBody(req);
      if (!isPasscodeValid(req, payload)) {
        sendJson(res, 401, {
          error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
          code: "LOCKED"
        });
        return;
      }

      const result = await handleVertexImageGeneration(payload);
      if (result.ok) {
        sendJson(res, 200, { imageData: result.imageData });
      } else {
        sendJson(res, 500, { error: result.error, blocked: result.blocked });
      }
    } catch (err: any) {
      console.error('[API Error /image-generate]:', err);
      sendJson(res, 400, { error: err.message || 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/gemini/image-excuse') {
    try {
      const payload = await parseJsonBody(req);
      if (!isPasscodeValid(req, payload)) {
        sendJson(res, 401, {
          error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
          code: "LOCKED"
        });
        return;
      }

      const result = await handleVertexImageExcuse(payload);
      if (result.ok) {
        sendJson(res, 200, { text: result.text });
      } else {
        sendJson(res, 500, { error: result.error });
      }
    } catch (err: any) {
      console.error('[API Error /image-excuse]:', err);
      sendJson(res, 400, { error: err.message || 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'GET' && url === '/api/gemini/status') {
    sendJson(res, 200, {
      status: 'online',
      provider: 'Vertex AI',
      project: process.env.VERTEX_PROJECT_ID || GCP_CONFIG.projectId,
      region: process.env.VERTEX_LOCATION || GCP_CONFIG.defaultRegion,
    });
    return;
  }

  next();
}
