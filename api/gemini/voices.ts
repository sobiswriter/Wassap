import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleAuth } from 'google-auth-library';

const VERTEX_PASSCODE = 'Ness2020';
const DEFAULT_GCP_PROJECT = 'gen-lang-client-0100408368';

function isPasscodeValid(req: IncomingMessage & { body?: any }, payload?: any): boolean {
  const headerCode = req.headers['x-vertex-passcode'] || req.headers['x-passcode'];
  const bodyCode = payload?.passcode;
  return headerCode === VERTEX_PASSCODE || bodyCode === VERTEX_PASSCODE;
}

function normalizePrivateKey(key?: string): string {
  if (!key) return '';
  let cleaned = key.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\r/g, '');
  const headerMatch = cleaned.match(/-----BEGIN [A-Z ]+-----/);
  const footerMatch = cleaned.match(/-----END [A-Z ]+-----/);
  if (headerMatch && footerMatch) {
    const header = headerMatch[0];
    const footer = footerMatch[0];
    const startIndex = cleaned.indexOf(header) + header.length;
    const endIndex = cleaned.indexOf(footer);
    const body = cleaned.substring(startIndex, endIndex).replace(/\s+/g, '');
    const formattedBody = body.match(/.{1,64}/g)?.join('\n') || body;
    return `${header}\n${formattedBody}\n${footer}\n`;
  }
  return cleaned;
}

function getAuthDetails() {
  const serviceAccountJson =
    process.env.GCP_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_CREDENTIALS;

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

  let saProjectId: string | undefined = undefined;
  let credentials: any = undefined;

  if (serviceAccountJson) {
    try {
      const parsed = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
      saProjectId = parsed.project_id;
      if (parsed.private_key) {
        parsed.private_key = normalizePrivateKey(parsed.private_key);
      }
      credentials = parsed;
    } catch {}
  } else if (clientEmail && privateKey) {
    credentials = {
      client_email: clientEmail.trim(),
      private_key: normalizePrivateKey(privateKey),
    };
  }

  const project = process.env.VERTEX_PROJECT_ID || saProjectId || DEFAULT_GCP_PROJECT;
  return { project, credentials };
}

async function getVertexAccessToken(): Promise<{ token: string; project: string }> {
  const { project, credentials } = getAuthDetails();
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    credentials,
    projectId: project,
  });
  const client = await auth.getClient();
  if ((client as any).quotaProjectId === undefined) {
    (client as any).quotaProjectId = project;
  }
  const tokenRes = await client.getAccessToken();
  if (!tokenRes || !tokenRes.token) {
    throw new Error('Failed to retrieve access token from Google Cloud credentials');
  }
  return { token: tokenRes.token, project };
}

function pcmToWavDataUrl(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  if (pcmBase64.startsWith('data:audio/')) return pcmBase64;
  if (pcmBase64.startsWith('UklGR')) return `data:audio/wav;base64,${pcmBase64}`;
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  return `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
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

export default async function handler(
  req: IncomingMessage & { body?: any; method?: string; query?: any; url?: string },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-vertex-passcode, x-passcode, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    let payload: any = {};
    if (req.method === 'POST') {
      payload = await parseJsonBody(req);
    }

    if (!isPasscodeValid(req, payload)) {
      sendJson(res, 401, {
        error: "Built-in Cloud (Vertex AI) is locked behind password protection. Please enter the passcode in Settings.",
        code: "LOCKED"
      });
      return;
    }

    const { token, project } = await getVertexAccessToken();
    const baseUrl = `https://aiplatform.googleapis.com/v1beta1/projects/${project}/locations/global/voices`;

    // 1. LIST VOICES (GET)
    if (req.method === 'GET') {
      const resp = await fetch(`${baseUrl}?type=prompted&type=replicated`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Goog-User-Project': project,
        }
      });
      const data = await resp.json();
      if (!resp.ok) {
        sendJson(res, resp.status, { error: data.error?.message || 'Failed to list voices', details: data });
        return;
      }
      sendJson(res, 200, { ok: true, voices: data.voices || [] });
      return;
    }

    // 2. DELETE VOICE (DELETE)
    if (req.method === 'DELETE') {
      const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const voiceId = urlObj.searchParams.get('id') || payload?.id;
      if (!voiceId) {
        sendJson(res, 400, { error: 'Voice ID is required for deletion' });
        return;
      }
      const resp = await fetch(`${baseUrl}/${encodeURIComponent(voiceId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Goog-User-Project': project,
        }
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        sendJson(res, resp.status, { error: data.error?.message || 'Failed to delete voice' });
        return;
      }
      sendJson(res, 200, { ok: true, deletedId: voiceId });
      return;
    }

    // 3. CREATE VOICE (POST: action = 'design' | 'replicate')
    if (req.method === 'POST') {
      const { action } = payload;

      if (action === 'design') {
        const { displayName, prompt, gender, languageCode } = payload;
        if (!prompt || !prompt.trim()) {
          sendJson(res, 400, { error: 'Prompt description is required to design a voice' });
          return;
        }

        const voicePayload: any = {
          store: true,
          voice: {
            type: 'VOICE_TYPE_PROMPTED',
            displayName: displayName || 'Custom Designed Voice',
            prompted: {
              input: prompt.trim()
            }
          }
        };

        if (gender) voicePayload.voice.gender = gender;
        if (languageCode) voicePayload.voice.languageCode = languageCode;

        const resp = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Goog-User-Project': project,
          },
          body: JSON.stringify(voicePayload)
        });

        const data = await resp.json();
        if (!resp.ok) {
          sendJson(res, resp.status, {
            error: data.error?.message || 'Failed to craft voice with Vertex AI Voices API',
            details: data
          });
          return;
        }

        let sampleAudioUrl: string | undefined = undefined;
        if (data.sample_audio?.data) {
          sampleAudioUrl = pcmToWavDataUrl(data.sample_audio.data);
        } else if (data.sampleAudio?.data) {
          sampleAudioUrl = pcmToWavDataUrl(data.sampleAudio.data);
        }

        const uniqueVoiceId = data.id 
          || (data.name ? data.name.split('/').pop() : undefined)
          || (data.voice?.id || (data.voice?.name ? data.voice.name.split('/').pop() : undefined))
          || `voice_designed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        sendJson(res, 200, {
          ok: true,
          id: uniqueVoiceId,
          displayName: data.displayName || data.voice?.displayName || displayName || 'Designed Voice',
          sampleAudioDataUrl: sampleAudioUrl,
          usage: data.usage
        });
        return;
      }

      if (action === 'replicate') {
        const { displayName, sourceAudio, consentAudio, store = true, model = 'gemini-3.8-flash-tts' } = payload;
        if (!sourceAudio) {
          sendJson(res, 400, { error: 'Reference audio (sourceAudio) is required for voice replication' });
          return;
        }
        if (!consentAudio) {
          sendJson(res, 400, { error: 'Consent audio recording is required for voice replication. Please record or upload the speaker reciting the required consent phrase.' });
          return;
        }

        const cleanSourceB64 = sourceAudio.replace(/^data:audio\/[^;]+;base64,/, '');
        const cleanConsentB64 = consentAudio.replace(/^data:audio\/[^;]+;base64,/, '');

        const voicePayload: any = {
          store: Boolean(store),
          voice: {
            type: 'VOICE_TYPE_REPLICATED',
            replicated: {
              sourceAudio: {
                mimeType: 'audio/wav',
                data: cleanSourceB64
              },
              consentAudio: {
                mimeType: 'audio/wav',
                data: cleanConsentB64
              }
            }
          }
        };

        if (displayName) {
          voicePayload.voice.displayName = displayName;
        }

        if (!store) {
          voicePayload.voice.model = model;
        }

        const resp = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Goog-User-Project': project,
          },
          body: JSON.stringify(voicePayload)
        });

        const data = await resp.json();
        if (!resp.ok) {
          sendJson(res, resp.status, {
            error: data.error?.message || 'Failed to replicate voice with Vertex AI Voices API',
            details: data
          });
          return;
        }

        const uniqueVoiceId = data.id 
          || data.key 
          || (data.name ? data.name.split('/').pop() : undefined)
          || (data.voice?.id || (data.voice?.name ? data.voice.name.split('/').pop() : undefined))
          || `voice_replicated_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        sendJson(res, 200, {
          ok: true,
          id: uniqueVoiceId,
          key: data.key,
          displayName: displayName || 'Replicated Voice',
          store: Boolean(store)
        });
        return;
      }

      sendJson(res, 400, { error: `Invalid action '${action}'. Expected 'design' or 'replicate'` });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[Voices API Handler Error]:', err);
    sendJson(res, 500, {
      error: err?.message || 'Internal server error while processing Voices request',
      code: 'VOICES_API_ERROR'
    });
  }
}
