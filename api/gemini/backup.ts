import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function requestOriginAllowed(req: IncomingMessage): boolean {
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean((req.socket as any)?.encrypted) || Boolean(process.env.VERCEL);
    return ['http:', 'https:'].includes(origin.protocol) && !origin.username && !origin.password
      && origin.host === req.headers.host && (!secure || origin.protocol === 'https:');
  } catch { return false; }
}

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

function sendJson(res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }, statusCode: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(data);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function parseJsonBody<T = any>(req: IncomingMessage & { body?: any }): Promise<T> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return req.body as T;
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      try {
        return JSON.parse(req.body);
      } catch (e) {
        return {} as T;
      }
    }
  }

  return new Promise((resolve, reject) => {
    let body = ''; let size = 0; let oversized = false;
    req.setEncoding?.('utf8');
    req.on('data', chunk => {
      if (oversized) return;
      size += Buffer.byteLength(chunk);
      if (size > 15 * 1024 * 1024) { // Allow up to 15MB for state backups
        oversized = true; reject(Object.assign(new Error('Payload too large'), { statusCode: 413 })); return;
      }
      body += chunk;
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

function getStorageDir(): string {
  const dir = process.env.VERCEL ? '/tmp/wassap_backups' : join(process.cwd(), '.data', 'cloud_slots');
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.warn('Could not create backup directory:', e);
    }
  }
  return dir;
}

export interface BackupSlotMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  chatCount: number;
  messageCount: number;
  personaCount: number;
  sizeBytes: number;
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  if (!requestOriginAllowed(req)) {
    sendJson(res, 403, { error: 'Invalid origin' });
    return;
  }

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const slotIdParam = url.searchParams.get('id') || url.searchParams.get('slotId');
  const actionParam = url.searchParams.get('action');

  let body: any = {};
  if (['POST', 'PUT', 'DELETE'].includes(req.method || '')) {
    try {
      body = await parseJsonBody(req);
    } catch (err: any) {
      if (err?.statusCode === 413) { sendJson(res, 413, { error: 'Payload too large' }); return; }
      body = {};
    }
  }

  // Validate passcode
  if (!isPasscodeValid(req, body)) {
    sendJson(res, 401, {
      error: 'Password required or invalid passcode. Enter your passkey to access Cloud Save.',
      code: 'LOCKED'
    });
    return;
  }

  const storageDir = getStorageDir();
  const targetSlotId = body.slotId || body.id || slotIdParam;
  const action = body.action || actionParam || (targetSlotId ? (req.method === 'DELETE' ? 'delete' : 'restore') : (req.method === 'POST' ? 'save' : 'list'));

  try {
    // 1. LIST SLOTS
    if (action === 'list' || (req.method === 'GET' && !targetSlotId)) {
      const files = existsSync(storageDir) ? readdirSync(storageDir).filter(f => f.endsWith('.json')) : [];
      const slots: BackupSlotMeta[] = [];

      for (const file of files) {
        try {
          const filePath = join(storageDir, file);
          const content = readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(content);
          const stat = statSync(filePath);

          slots.push({
            id: parsed.id || file.replace('.json', ''),
            title: parsed.title || 'Untitled Save',
            createdAt: parsed.createdAt || stat.birthtime.toISOString(),
            updatedAt: parsed.updatedAt || stat.mtime.toISOString(),
            chatCount: parsed.chatCount ?? (Array.isArray(parsed.payload?.chats) ? parsed.payload.chats.length : 0),
            messageCount: parsed.messageCount ?? (Array.isArray(parsed.payload?.chats) ? parsed.payload.chats.reduce((acc: number, c: any) => acc + (c.messages?.length || 0), 0) : 0),
            personaCount: parsed.personaCount ?? (Array.isArray(parsed.payload?.chats) ? parsed.payload.chats.filter((c: any) => !c.isGroup).length : 0),
            sizeBytes: stat.size
          });
        } catch (e) {
          console.warn(`Error reading backup slot ${file}:`, e);
        }
      }

      slots.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      sendJson(res, 200, { ok: true, slots });
      return;
    }

    // 2. RETRIEVE A SPECIFIC SLOT
    if (action === 'restore' || (req.method === 'GET' && targetSlotId)) {
      const safeId = (typeof targetSlotId === 'string' ? targetSlotId : '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeId) {
        sendJson(res, 400, { error: 'Valid slot ID is required' });
        return;
      }
      const filePath = join(storageDir, `${safeId}.json`);

      if (!existsSync(filePath)) {
        sendJson(res, 404, { error: 'Backup slot not found' });
        return;
      }

      const content = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      sendJson(res, 200, { ok: true, slot: parsed });
      return;
    }

    // 3. SAVE / CREATE A SLOT
    if (action === 'save' || req.method === 'POST') {
      const { title, payload } = body;
      if (!payload || typeof payload !== 'object') {
        sendJson(res, 400, { error: 'Backup payload is required' });
        return;
      }

      const rawId = (typeof targetSlotId === 'string' ? targetSlotId : '').replace(/[^a-zA-Z0-9_-]/g, '');
      const slotId = rawId || `slot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();

      const chats = Array.isArray(payload.chats) ? payload.chats : [];
      const chatCount = chats.length;
      const messageCount = chats.reduce((acc: number, c: any) => acc + (Array.isArray(c.messages) ? c.messages.length : 0), 0);
      const personaCount = chats.filter((c: any) => !c.isGroup).length;

      const slotData = {
        id: slotId,
        title: (title || 'Quick Save').trim().slice(0, 80),
        createdAt: body.createdAt || nowIso,
        updatedAt: nowIso,
        chatCount,
        messageCount,
        personaCount,
        payload
      };

      const filePath = join(storageDir, `${slotId}.json`);
      writeFileSync(filePath, JSON.stringify(slotData, null, 2), 'utf8');

      sendJson(res, 200, {
        ok: true,
        slot: {
          id: slotData.id,
          title: slotData.title,
          createdAt: slotData.createdAt,
          updatedAt: slotData.updatedAt,
          chatCount,
          messageCount,
          personaCount
        }
      });
      return;
    }

    // 4. DELETE A SLOT
    if (action === 'delete' || req.method === 'DELETE') {
      const safeId = (typeof targetSlotId === 'string' ? targetSlotId : '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeId) {
        sendJson(res, 400, { error: 'Valid slot ID is required to delete' });
        return;
      }
      const filePath = join(storageDir, `${safeId}.json`);

      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }

      sendJson(res, 200, { ok: true, deletedId: safeId });
      return;
    }

    sendJson(res, 405, { error: 'Method or action not allowed' });
  } catch (err: any) {
    console.error('Backup handler error:', err);
    sendJson(res, 500, { error: err.message || 'Server error processing backup' });
  }
}
