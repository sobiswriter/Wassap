import type { IncomingMessage, ServerResponse } from 'http';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-giphy-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const parsedUrl = new URL(req.url || '', 'http://localhost');
    const q = (parsedUrl.searchParams.get('q') || '').trim();
    const type = (parsedUrl.searchParams.get('type') || 'gifs').toLowerCase();
    const limit = Math.min(parseInt(parsedUrl.searchParams.get('limit') || '24', 10) || 24, 50);
    const key = (
      parsedUrl.searchParams.get('apiKey') ||
      (req.headers['x-giphy-key'] as string) ||
      process.env.GIPHY_API_KEY ||
      process.env.VITE_GIPHY_API_KEY ||
      ''
    ).trim();

    if (!key) {
      sendJson(res, 400, {
        ok: false,
        error: 'NO_KEY',
        message: 'No GIPHY API key configured. Please enter your free GIPHY API key in Settings.',
      });
      return;
    }

    const endpointType = type === 'stickers' ? 'stickers' : 'gifs';
    const baseUrl = q
      ? `https://api.giphy.com/v1/${endpointType}/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g`
      : `https://api.giphy.com/v1/${endpointType}/trending?api_key=${encodeURIComponent(key)}&limit=${limit}&rating=g`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const giphyRes = await fetch(baseUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!giphyRes.ok) {
      const errData = await giphyRes.json().catch(() => ({}));
      sendJson(res, giphyRes.status, {
        ok: false,
        error: errData?.meta?.msg || 'GIPHY API request failed',
        status: giphyRes.status,
      });
      return;
    }

    const json = await giphyRes.json();
    const items = (json.data || []).map((item: any) => ({
      id: item.id,
      name: item.title?.replace(/ GIF$/i, '').trim() || (type === 'stickers' ? 'Sticker' : 'GIF'),
      category: 'trending',
      url: item.images?.fixed_height?.url || item.images?.original?.url || item.images?.downsized?.url || item.url,
      previewUrl: item.images?.fixed_height_small?.url || item.images?.fixed_height?.url,
      tags: [item.title || 'giphy', type],
    }));

    sendJson(res, 200, { ok: true, data: items });
  } catch (err: any) {
    console.error('[GIPHY Search Error]:', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}
