import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

const privateMediaAddresses = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) privateMediaAddresses.addSubnet(address, prefix, 'ipv4');
const globalMediaIPv6 = new BlockList();
globalMediaIPv6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  privateMediaAddresses.addSubnet(address, prefix, 'ipv6');
}

export function isPublicMediaAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !privateMediaAddresses.check(address, 'ipv4')
    : family === 6 && globalMediaIPv6.check(address, 'ipv6') && !privateMediaAddresses.check(address, 'ipv6');
}

export async function fetchRemoteMedia(url: string, maxBytes = 8 * 1024 * 1024, timeoutMs = 6000): Promise<{ data: Buffer; mimeType: string }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Remote media timed out'));
    }, timeoutMs);
  });
  const download = async (target: string, redirects = 0): Promise<{ data: Buffer; mimeType: string }> => {
    const parsed = new URL(target);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid media URL');
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await dns.lookup(hostname, { all: true, verbatim: true });
    controller.signal.throwIfAborted();
    if (!addresses.length || addresses.some(item => !isPublicMediaAddress(item.address))) throw new Error('Private or reserved media address blocked');
    const address = addresses[0];
    return new Promise((resolve, reject) => {
      const request = (parsed.protocol === 'https:' ? https : http).request(parsed, {
        signal: controller.signal,
        headers: { Accept: 'image/*,audio/*,*/*', 'User-Agent': 'Mozilla/5.0 (compatible; WassapBot/1.0)' },
        // Pin the checked address so a second DNS lookup cannot reach a private host.
        lookup: ((_host: string, options: any, callback: any) => options?.all
          ? callback(null, [address]) : callback(null, address.address, address.family)) as any,
      }, response => {
        const status = response.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.destroy();
          if (!response.headers.location || redirects >= 3) { reject(new Error('Too many media redirects')); return; }
          try { resolve(download(new URL(response.headers.location, parsed).href, redirects + 1)); }
          catch (error) { reject(error); }
          return;
        }
        const mimeType = (response.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
        if (status < 200 || status >= 300 || mimeType.includes('svg') || (!mimeType.startsWith('image/') && !mimeType.startsWith('audio/') && mimeType !== 'application/octet-stream')) {
          response.destroy(); reject(new Error('Unsupported remote media response')); return;
        }
        if (Number(response.headers['content-length']) > maxBytes) {
          response.destroy(); reject(new Error('Remote media exceeds size limit')); return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) { response.destroy(); reject(new Error('Remote media exceeds size limit')); }
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('aborted', () => reject(new Error('Remote media download interrupted')));
        response.on('end', () => resolve({ data: Buffer.concat(chunks), mimeType }));
      });
      request.on('error', reject);
      request.end();
    });
  };
  try { return await Promise.race([download(url), timeout]); }
  finally { clearTimeout(timer!); }
}
