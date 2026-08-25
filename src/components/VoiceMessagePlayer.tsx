import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { formatMediaDuration } from '../utils/media';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  isSender?: boolean;
}

// Generate static simulated waveform heights based on audioUrl hash
function getWaveformBars(seed: string, count = 28): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const val = Math.abs(Math.sin((hash + i * 17) * 0.45));
    // Range between 20% and 100%
    bars.push(Math.max(20, Math.round(val * 100)));
  }
  return bars;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration = 0,
  isSender = false
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);

  const waveformBars = useRef(getWaveformBars(audioUrl, 24)).current;

  // Initialize and attach audio listeners
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
    };
  }, [audioUrl]);

  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Audio play failed:', e);
      });
    }
  };

  // Change playback speed
  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds: (1 | 1.5 | 2)[] = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Seek on waveform bar click
  const handleSeek = (index: number) => {
    if (!audioRef.current) return;
    const progressRatio = (index + 1) / waveformBars.length;
    const targetTime = progressRatio * (totalDuration || 1);
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[210px] sm:min-w-[250px] select-none">
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-xs ${
          isSender
            ? 'bg-white text-indigo-700 hover:bg-slate-100'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? (
          <Pause size={17} className="fill-current" />
        ) : (
          <Play size={17} className="fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Time Controls */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        {/* Waveform Bar Track */}
        <div className="flex items-center gap-0.5 h-6 cursor-pointer py-1" title="Click to seek">
          {waveformBars.map((heightPercent, idx) => {
            const barProgress = ((idx + 1) / waveformBars.length) * 100;
            const isPlayed = barProgress <= progressPercent;

            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                style={{ height: `${heightPercent}%` }}
                className={`flex-1 rounded-full transition-all duration-75 ${
                  isPlayed
                    ? isSender
                      ? 'bg-white'
                      : 'bg-indigo-600 dark:bg-indigo-400'
                    : isSender
                    ? 'bg-white/40 hover:bg-white/70'
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
              />
            );
          })}
        </div>

        {/* Duration & Speed indicators */}
        <div
          className={`flex items-center justify-between text-[11px] font-mono leading-none ${
            isSender ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>
            {isPlaying
              ? formatMediaDuration(currentTime)
              : formatMediaDuration(totalDuration || duration)}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleSpeed}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                isSender
                  ? 'bg-white/20 hover:bg-white/30 text-white'
                  : 'bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title="Change playback speed"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
