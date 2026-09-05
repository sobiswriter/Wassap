import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { formatAudioDuration, generateWaveformBars } from '../utils/audio';

// Custom WhatsApp microphone SVG icon
const WhatsAppMicIcon = ({ size = 13, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
    <path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531-2.001 0-3.531 1.53-3.531 3.531v7.061c0 2.001 1.53 3.531 3.531 3.531z" />
    <path d="M17.653 11.411v-1.127h-1.611v1.127c0 2.228-1.802 4.031-4.043 4.031-2.241 0-4.043-1.803-4.043-4.031v-1.127H6.345v1.127c0 2.85 2.148 5.215 4.848 5.626v2.333h1.611v-2.333c2.7-.411 4.849-2.776 4.849-5.626z" />
  </svg>
);

interface VoiceNotePlayerProps {
  src: string;
  seedId?: string;
  transcript?: string;
  isMe?: boolean;
  avatar?: string;
  senderName?: string;
}

// Global reference so only one voice note plays at any given time
let currentPlayingAudio: HTMLAudioElement | null = null;

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  src,
  seedId = 'voice',
  transcript,
  isMe = false,
  avatar,
  senderName,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [waveform] = useState(() => generateWaveformBars(seedId, 34));

  // Sync audio duration once loaded
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    // Initial check if already loaded
    if (audio.readyState >= 1 && audio.duration) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [src]);

  // Toggle play/pause with single-audio concurrency enforcement
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      if (currentPlayingAudio && currentPlayingAudio !== audio) {
        currentPlayingAudio.pause();
      }
      currentPlayingAudio = audio;
      audio.play().catch(err => console.error("Playback failed:", err));
    }
  };

  // Cycle playback speed: 1x -> 1.5x -> 2x -> 1x
  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  // Seek logic based on waveform click / drag
  const seekToPosition = useCallback((clientX: number) => {
    const barContainer = waveformRef.current;
    const audio = audioRef.current;
    if (!barContainer || !audio || !duration) return;

    const rect = barContainer.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    const targetTime = percentage * duration;

    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  }, [duration]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    seekToPosition(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) {
        seekToPosition(moveEvent.clientX);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      isDraggingRef.current = true;
      seekToPosition(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDraggingRef.current && e.touches.length > 0) {
      seekToPosition(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) : 0;
  const currentBarIndex = Math.floor(progressPercent * waveform.length);

  return (
    <div className="flex flex-col w-full max-w-[340px] sm:max-w-[360px] select-none py-1">
      {/* Hidden native audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* WhatsApp Voice Note Card */}
      <div className="flex items-center gap-3 px-1 py-1">
        {/* Avatar with WhatsApp microphone badge */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-black/5 dark:bg-white/10 flex items-center justify-center border border-black/5 dark:border-white/5 shadow-sm">
            {avatar ? (
              <img src={avatar} alt={senderName || "Speaker"} className="w-full h-full object-cover" />
            ) : (
              <span className="text-secondary font-semibold text-sm">
                {(senderName || (isMe ? 'You' : 'VN')).charAt(0)}
              </span>
            )}
          </div>
          {/* Green microphone badge */}
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#00a884] rounded-full flex items-center justify-center text-white shadow-sm ring-2 ring-white dark:ring-[#1f2c34]">
            <WhatsAppMicIcon size={10} />
          </div>
        </div>

        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          type="button"
          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0 shadow-sm"
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        {/* Waveform Scrubber & Metadata */}
        <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
          {/* Waveform Bars Scrubber */}
          <div
            ref={waveformRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex items-center gap-[2.5px] sm:gap-[3px] h-7 cursor-pointer group py-1 relative"
            title="Click or drag to seek"
          >
            {waveform.map((barHeight, idx) => {
              const isPlayed = idx <= currentBarIndex;
              return (
                <span
                  key={idx}
                  className={`w-[3px] rounded-full transition-colors duration-150 ${
                    isPlayed
                      ? 'bg-[#00a884] dark:bg-[#00a884]'
                      : 'bg-[#b4bcc2] dark:bg-[#53616a] group-hover:bg-[#8696a0]'
                  }`}
                  style={{
                    height: `${Math.round(barHeight * 22) + 4}px`,
                  }}
                />
              );
            })}

            {/* Position scrubber dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#00a884] rounded-full shadow-sm pointer-events-none transition-transform duration-75"
              style={{
                left: `${Math.min(Math.max(progressPercent * 100, 0), 100)}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>

          {/* Time & Speed Controls */}
          <div className="flex items-center justify-between text-[11px] text-secondary font-medium tracking-tight mt-0.5">
            <span>
              {isPlaying || currentTime > 0
                ? `${formatAudioDuration(currentTime)} / ${formatAudioDuration(duration || 0)}`
                : formatAudioDuration(duration || 0)}
            </span>

            <div className="flex items-center gap-2">
              {/* WhatsApp Playback Speed Pill */}
              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="px-1.5 py-0.5 bg-black/5 dark:bg-white/10 hover:bg-[#00a884]/20 hover:text-[#00a884] rounded text-[10px] font-bold text-secondary transition-colors"
                title="Change playback speed"
              >
                {playbackRate}x
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Transcript Section */}
      {transcript && transcript.trim().length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-black/5 dark:border-white/10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTranscript(!showTranscript);
            }}
            className="flex items-center gap-1.5 text-[11px] text-[#00a884] dark:text-[#00a884] font-medium hover:underline focus:outline-none transition-colors"
          >
            <FileText size={12} />
            <span>{showTranscript ? "Hide Transcript" : "View Transcript"}</span>
            {showTranscript ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showTranscript && (
            <div className="mt-1.5 px-2 py-1.5 bg-black/5 dark:bg-black/20 rounded-md text-[calc(var(--msg-font-size)-2px)] text-primary leading-relaxed whitespace-pre-wrap animate-in fade-in-50 duration-200">
              {transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
