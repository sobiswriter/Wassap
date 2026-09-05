import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImageLightboxModalProps {
  src: string;
  caption?: string;
  senderName?: string;
  timestamp?: string;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  src,
  caption,
  senderName,
  timestamp,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = src;
    link.download = `photo-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex flex-col justify-between p-2 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div
        className="flex items-center justify-between px-2 sm:px-4 py-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col text-white">
          <span className="font-semibold text-sm sm:text-base">
            {senderName || 'Photo'}
          </span>
          {timestamp && (
            <span className="text-xs text-white/60">{timestamp}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Download photo"
          >
            <Download size={20} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 flex items-center justify-center p-2 min-h-0 overflow-hidden"
        onClick={onClose}
      >
        <img
          src={src}
          alt={caption || 'Full screen photo view'}
          className="max-w-full max-h-[78vh] sm:max-h-[82vh] object-contain rounded-xl shadow-2xl cursor-default transition-all duration-300"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Bottom Caption Bar */}
      {caption && (
        <div
          className="max-w-2xl mx-auto w-full px-4 py-3 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-white text-center text-sm sm:text-base shadow-xl mb-2 sm:mb-4 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="leading-relaxed whitespace-pre-wrap">{caption}</p>
        </div>
      )}
    </div>
  );
};
