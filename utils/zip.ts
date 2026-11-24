/**
 * Lightweight, zero-dependency ZIP archive creator for the browser.
 * Uses standard ZIP format (Store mode / uncompressed) with CRC32.
 * Universally readable by Windows Explorer, macOS Archive Utility, Linux, Android, and 7-Zip.
 */

// Standard CRC32 lookup table
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

export function computeCRC32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array | string;
}

export function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileRecords: {
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  let totalLocalSize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name.replace(/\\/g, '/'));
    const dataBytes = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const crc = computeCRC32(dataBytes);

    fileRecords.push({
      nameBytes,
      dataBytes,
      crc,
      offset: totalLocalSize
    });

    // 30 bytes header + name + data
    totalLocalSize += 30 + nameBytes.length + dataBytes.length;
  }

  let centralDirSize = 0;
  for (const record of fileRecords) {
    // 46 bytes CD header + name
    centralDirSize += 46 + record.nameBytes.length;
  }

  // 22 bytes End of Central Directory
  const totalZipSize = totalLocalSize + centralDirSize + 22;
  const buffer = new Uint8Array(totalZipSize);
  const view = new DataView(buffer.buffer);

  let pos = 0;

  // 1. Write Local File Headers & Data
  for (const record of fileRecords) {
    view.setUint32(pos, 0x04034B50, true); // Local file header signature
    view.setUint16(pos + 4, 20, true);     // Version needed (2.0)
    view.setUint16(pos + 6, 0x0800, true); // General purpose bit flag (UTF-8)
    view.setUint16(pos + 8, 0, true);      // Compression: 0 (Store)
    view.setUint16(pos + 10, 0, true);     // Mod time
    view.setUint16(pos + 12, 0, true);     // Mod date
    view.setUint32(pos + 14, record.crc, true); // CRC32
    view.setUint32(pos + 18, record.dataBytes.length, true); // Compressed size
    view.setUint32(pos + 22, record.dataBytes.length, true); // Uncompressed size
    view.setUint16(pos + 26, record.nameBytes.length, true); // Filename length
    view.setUint16(pos + 28, 0, true);     // Extra field length
    pos += 30;

    buffer.set(record.nameBytes, pos);
    pos += record.nameBytes.length;

    buffer.set(record.dataBytes, pos);
    pos += record.dataBytes.length;
  }

  const centralDirStartOffset = pos;

  // 2. Write Central Directory Headers
  for (const record of fileRecords) {
    view.setUint32(pos, 0x02014B50, true); // Central directory file header signature
    view.setUint16(pos + 4, 20, true);     // Version made by
    view.setUint16(pos + 6, 20, true);     // Version needed
    view.setUint16(pos + 8, 0x0800, true); // Bit flag (UTF-8)
    view.setUint16(pos + 10, 0, true);     // Compression: Store
    view.setUint16(pos + 12, 0, true);     // Mod time
    view.setUint16(pos + 14, 0, true);     // Mod date
    view.setUint32(pos + 16, record.crc, true); // CRC32
    view.setUint32(pos + 20, record.dataBytes.length, true); // Compressed size
    view.setUint32(pos + 24, record.dataBytes.length, true); // Uncompressed size
    view.setUint16(pos + 28, record.nameBytes.length, true); // Filename length
    view.setUint16(pos + 30, 0, true);     // Extra field length
    view.setUint16(pos + 32, 0, true);     // File comment length
    view.setUint16(pos + 34, 0, true);     // Disk number start
    view.setUint16(pos + 36, 0, true);     // Internal file attributes
    view.setUint32(pos + 38, 0, true);     // External file attributes
    view.setUint32(pos + 42, record.offset, true); // Relative offset of local header
    pos += 46;

    buffer.set(record.nameBytes, pos);
    pos += record.nameBytes.length;
  }

  // 3. Write End of Central Directory Record
  view.setUint32(pos, 0x06054B50, true); // EOCD signature
  view.setUint16(pos + 4, 0, true);      // Number of this disk
  view.setUint16(pos + 6, 0, true);      // Disk where central directory starts
  view.setUint16(pos + 8, fileRecords.length, true);  // Number of CD records on this disk
  view.setUint16(pos + 10, fileRecords.length, true); // Total number of CD records
  view.setUint32(pos + 12, centralDirSize, true);     // Size of central directory
  view.setUint32(pos + 16, centralDirStartOffset, true); // Offset of start of CD
  view.setUint16(pos + 20, 0, true);     // Comment length

  return buffer;
}

/**
 * Converts a base64 or data URL string to a Uint8Array.
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,');
  const base64Str = base64Index !== -1 ? dataUrl.slice(base64Index + 8) : dataUrl;
  const binaryStr = atob(base64Str);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}
