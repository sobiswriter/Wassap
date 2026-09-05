/**
 * Compresses an uploaded image file using an offscreen HTML canvas.
 * Scales image to maximum 1920x1920 while preserving aspect ratio,
 * and encodes to JPEG at 0.82 quality (~100KB-250KB).
 */
export const compressWallpaperImage = (file: File): Promise<string> => {
  return compressImage(file, 1920, 0.82);
};

/**
 * Compresses an uploaded image file or base64 data URL using an offscreen HTML canvas.
 * Scales image to a maximum dimension (default 1280px) while preserving aspect ratio,
 * and encodes to JPEG at specified quality (default 0.78).
 * Shrinks 5MB-15MB phone camera images down to ~100KB-200KB.
 */
export const compressImage = (
  source: File | string,
  maxDimension = 1280,
  quality = 0.78
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const processDataUrl = (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = dataUrl;
    };

    if (typeof source === 'string') {
      processDataUrl(source);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) {
          reject(new Error('Failed to read file'));
          return;
        }
        processDataUrl(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
};

