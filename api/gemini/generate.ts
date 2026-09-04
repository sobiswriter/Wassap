import type { IncomingMessage, ServerResponse } from 'http';
import { handleVertexChat } from '../_lib/vertexHandler';
import { parseJsonBody, sendJson, isPasscodeValid } from '../_lib/api';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-vertex-passcode, x-passcode');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

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
    console.error('[Vercel Serverless /api/gemini/generate Error]:', err);
    sendJson(res, 400, { error: err.message || 'Invalid request body' });
  }
}
