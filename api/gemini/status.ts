import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../../server/api';
import { GCP_CONFIG } from '../../constants';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const project = process.env.VERTEX_PROJECT_ID || GCP_CONFIG.projectId;
  const region = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || GCP_CONFIG.defaultRegion;
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
