import React, { useEffect, useRef, useState } from 'react';
import { StopPoint } from '../types';

interface VideoPlayerProps {
  videoId: string;
  stopPoints: StopPoint[];
  currentStopIndex: number;
  onTimeUpdate: (time: number) => void;
  onReachStopPoint: (index: number) => void;
  onSeekToStopPoint: (index: number, timestamp: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  seekToTimestamp?: number | null; // NEW: external seek request
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  stopPoints,
  currentStopIndex,
  onTimeUpdate,
  onReachStopPoint,
  onSeekToStopPoint,
  isPlaying,
  setIsPlaying,
  seekToTimestamp,
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Reset state when video changes
  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    setPlayerError(null);
  }, [videoId]);

  // Initialize YouTube API
  useEffect(() => {
    setPlayerError(null);
    let isMounted = true;

    const init = () => {
      if (!isMounted) return;
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
             if (isMounted) initializePlayer();
        };
      } else {
        initializePlayer();
      }
    };

    init();

    return () => {
      isMounted = false;
      stopTimer();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Player destroy failed", e);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const getSafeOrigin = () => {
    if (typeof window === 'undefined') return undefined;
    const origin = window.location.origin;
    if (!origin || origin === 'null' || origin === 'file://') return undefined;
    return origin;
  };

  const initializePlayer = () => {
    if (!containerRef.current) return;
    
    // Clear previous iframes
    containerRef.current.innerHTML = '<div id="yt-player"></div>';

    const safeOrigin = getSafeOrigin();
    
    // Core player variables
    const playerVars: any = {
      playsinline: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
    };

    // Only add origin if it is a valid http/https domain
    if (safeOrigin) {
      playerVars.origin = safeOrigin;
    }

    try {
        playerRef.current = new window.YT.Player('yt-player', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          host: 'https://www.youtube.com',
          playerVars: playerVars,
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError,
          },
        });
    } catch (e) {
        console.error("Failed to init player", e);
        setPlayerError("Failed to initialize video player.");
    }
  };

  const onPlayerReady = (event: any) => {
    // Get duration - sometimes it's 0 initially, so we'll also check in the timer
    const dur = event.target.getDuration();
    if (dur > 0) {
      setDuration(dur);
    }
    setPlayerError(null);
  };

  const onPlayerError = (event: any) => {
    console.error("YouTube Player Error Code:", event.data);
    const code = event.data;
    if (code === 150 || code === 101 || code === 153) {
        setPlayerError("This video cannot be played in embedded mode. The owner has restricted it.");
    } else {
        setPlayerError("An error occurred while loading the video.");
    }
    setIsPlaying(false);
  };

  const onPlayerStateChange = (event: any) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      startTimer();
      // Also try to get duration when video starts playing (fallback)
      if (playerRef.current && playerRef.current.getDuration) {
        const dur = playerRef.current.getDuration();
        if (dur > 0) {
          setDuration(dur);
        }
      }
    } else {
      setIsPlaying(false);
      stopTimer();
    }
  };

  const startTimer = () => {
    stopTimer();
    intervalRef.current = window.setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
        onTimeUpdate(time);
        
        // Fallback: update duration if it's still 0
        if (duration === 0 && playerRef.current.getDuration) {
          const dur = playerRef.current.getDuration();
          if (dur > 0) {
            setDuration(dur);
          }
        }
        
        // Check stop points
        const nextStop = stopPoints[currentStopIndex];
        if (nextStop && time >= nextStop.timestamp && time < nextStop.timestamp + 2) {
             playerRef.current.pauseVideo();
             onReachStopPoint(currentStopIndex);
        }
      }
    }, 500);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Sync play/pause prop with player
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      const playerState = playerRef.current.getPlayerState();
      
      if (isPlaying && playerState !== window.YT.PlayerState.PLAYING) {
        playerRef.current.playVideo();
      } else if (!isPlaying && playerState === window.YT.PlayerState.PLAYING) {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying]);

  // NEW: Handle external seek requests
  useEffect(() => {
    if (seekToTimestamp !== null && seekToTimestamp !== undefined && playerRef.current) {
      playerRef.current.seekTo(seekToTimestamp, true);
      // Update currentTime immediately so the blue timeline syncs
      setCurrentTime(seekToTimestamp);
    }
  }, [seekToTimestamp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekTo = (seconds: number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seconds, true);
      setCurrentTime(seconds);
    }
  };

  const handleMarkerClick = (idx: number, timestamp: number) => {
    seekTo(timestamp);
    onSeekToStopPoint?.(idx, timestamp);
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="relative w-full pt-[56.25%] bg-black rounded-xl overflow-hidden shadow-lg group">
         {playerError ? (
             <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
                 <svg className="w-12 h-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                 </svg>
                 <p className="font-medium text-lg">{playerError}</p>
                 <a 
                    href={`https://www.youtube.com/watch?v=${videoId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-4 px-4 py-2 bg-white text-slate-900 rounded hover:bg-slate-200 transition-colors text-sm font-bold"
                 >
                    Watch on YouTube
                 </a>
             </div>
         ) : (
            <div ref={containerRef} className="absolute top-0 left-0 w-full h-full" />
         )}
      </div>

      {/* Custom Timeline Visualizer */}
      <div className="relative h-12 w-full bg-slate-100 rounded-lg border border-slate-200 p-2 flex items-center">
        <div className="absolute left-2 text-xs font-mono text-slate-500">{formatTime(currentTime)}</div>
        <div className="absolute right-2 text-xs font-mono text-slate-500">{formatTime(duration)}</div>
        
        {/* Progress Bar Container */}
        <div className="relative mx-12 h-2 bg-slate-300 rounded-full flex-grow w-[calc(100%-6rem)]">
          {/* Progress */}
          <div 
            className="absolute h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min((currentTime / (duration || 1)) * 100, 100)}%` }}
          />
          
          {/* Stop Points Markers - only show if duration is valid and timestamp is within bounds */}
          {duration > 0 && stopPoints
            .filter(sp => sp.timestamp <= duration) // Filter out markers beyond video duration
            .map((sp, idx) => {
              const actualIdx = stopPoints.findIndex(s => s.id === sp.id);
              const leftPercent = Math.min((sp.timestamp / duration) * 100, 100);
              
              return (
                <button
                  key={sp.id}
                  onClick={() => handleMarkerClick(actualIdx, sp.timestamp)}
                  className={`absolute w-4 h-4 -mt-1 rounded-full border-2 border-white transform -translate-x-1/2 transition-all duration-200 z-10 cursor-pointer hover:scale-125 hover:ring-2 hover:ring-indigo-300
                    ${actualIdx < currentStopIndex ? 'bg-green-500' : actualIdx === currentStopIndex ? 'bg-amber-500 animate-pulse' : 'bg-slate-400 hover:bg-indigo-400'}`}
                  style={{ left: `${leftPercent}%` }}
                  title={`Q${actualIdx + 1}: ${formatTime(sp.timestamp)} - Click to jump`}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;