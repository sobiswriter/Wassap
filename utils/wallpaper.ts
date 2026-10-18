// Resolve the retired preset at render time; never rewrite a saved custom wallpaper.
export const resolveWallpaperUrl = (url: string): string =>
  url === 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80'
    ? '/images/misty-forest.svg'
    : url;

export const getWallpaperSize = (
  previous: { width: number; height: number },
  current: { width: number; height: number },
  mobile: boolean,
) => ({
  width: current.width,
  height: mobile && previous.width === current.width
    ? Math.max(previous.height, current.height)
    : current.height,
});
