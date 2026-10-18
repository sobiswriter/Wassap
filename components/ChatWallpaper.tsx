import React, { useLayoutEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { getWallpaperSize, resolveWallpaperUrl } from '../utils/wallpaper';

export const ChatWallpaper: React.FC<{ settings: AppSettings }> = ({ settings }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layer = ref.current;
    const pane = layer?.parentElement;
    if (!layer || !pane) return;
    let size = { width: 0, height: 0 };
    const resize = () => {
      // Keep the photo's crop when the keyboard hides the bottom of the conversation.
      size = getWallpaperSize(size, { width: pane.clientWidth, height: pane.clientHeight }, window.matchMedia('(max-width: 767px)').matches);
      layer.style.width = `${size.width}px`;
      layer.style.height = `${size.height}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} aria-hidden="true" className="absolute top-0 left-0 pointer-events-none chat-wallpaper"
    style={settings.chatWallpaper && settings.chatWallpaper !== 'default' ? {
      backgroundImage: `url("${resolveWallpaperUrl(settings.chatWallpaper)}"), url('/images/${settings.theme === 'dark' ? 'dark' : 'light'}.png')`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      opacity: settings.chatWallpaperOpacity ?? 0.85,
    } : undefined} />;
};
