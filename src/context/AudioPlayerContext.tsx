'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AudiusTrack } from '../hooks/useAudius';

interface AudioPlayerContextType {
  currentTrack: AudiusTrack | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  queue: AudiusTrack[];
  queueIndex: number;
  playTrack: (track: AudiusTrack, newQueue?: AudiusTrack[]) => void;
  pause: () => void;
  play: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  addToQueue: (track: AudiusTrack) => void;
  setQueue: (tracks: AudiusTrack[]) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<AudiusTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.5); // Default 50%
  const [queue, setQueueState] = useState<AudiusTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    // Load volume from localstorage if available
    const savedVol = localStorage.getItem('collabcode_player_volume');
    if (savedVol !== null) {
      const volNum = parseFloat(savedVol);
      audio.volume = volNum;
      setVolumeState(volNum);
    } else {
      audio.volume = 0.5;
    }

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      // Auto-advance
      nextTrackRef.current();
    };

    const onCanPlay = () => {
      if (isPlayingRef.current) {
        audio.play().catch((e) => console.log('Playback error:', e));
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('canplay', onCanPlay);
      audioRef.current = null;
    };
  }, []);

  // Sync state refs to prevent dependencies in event listeners
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  useEffect(() => {
    queueRef.current = queue;
    queueIndexRef.current = queueIndex;
  }, [queue, queueIndex]);

  // Set up volume control
  const setVolume = useCallback((vol: number) => {
    const safeVol = Math.max(0, Math.min(1, vol));
    setVolumeState(safeVol);
    localStorage.setItem('collabcode_player_volume', safeVol.toString());
    if (audioRef.current) {
      audioRef.current.volume = safeVol;
    }
  }, []);

  const play = useCallback(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.log('Playback error:', e));
    }
  }, [currentTrack]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const playTrack = useCallback((track: AudiusTrack, newQueue?: AudiusTrack[]) => {
    if (!audioRef.current) return;

    if (newQueue) {
      setQueueState(newQueue);
      const idx = newQueue.findIndex((t) => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else {
      // Check if track is already in queue
      const existingIdx = queueRef.current.findIndex((t) => t.id === track.id);
      if (existingIdx !== -1) {
        setQueueIndex(existingIdx);
      } else {
        const updatedQueue = [...queueRef.current, track];
        setQueueState(updatedQueue);
        setQueueIndex(updatedQueue.length - 1);
      }
    }

    setCurrentTrack(track);
    audioRef.current.src = track.streamUrl;
    audioRef.current.load();
    setIsPlaying(true);
    // Play will auto-trigger on canplay event
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;
    const nextIdx = (idx + 1) % q.length;
    setQueueIndex(nextIdx);
    const nextTrack = q[nextIdx];
    setCurrentTrack(nextTrack);
    if (audioRef.current) {
      audioRef.current.src = nextTrack.streamUrl;
      audioRef.current.load();
      setIsPlaying(true);
    }
  }, []);

  const prev = useCallback(() => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (q.length === 0) return;
    const prevIdx = (idx - 1 + q.length) % q.length;
    setQueueIndex(prevIdx);
    const prevTrack = q[prevIdx];
    setCurrentTrack(prevTrack);
    if (audioRef.current) {
      audioRef.current.src = prevTrack.streamUrl;
      audioRef.current.load();
      setIsPlaying(true);
    }
  }, []);

  const nextTrackRef = useRef(next);
  useEffect(() => {
    nextTrackRef.current = next;
  }, [next]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const addToQueue = useCallback((track: AudiusTrack) => {
    setQueueState((prevQueue) => {
      if (prevQueue.some((t) => t.id === track.id)) return prevQueue;
      return [...prevQueue, track];
    });
  }, []);

  const setQueue = useCallback((tracks: AudiusTrack[]) => {
    setQueueState(tracks);
    setQueueIndex(-1);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const active = document.activeElement;
        const isInput =
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.getAttribute('contenteditable') === 'true');
        if (!isInput) {
          e.preventDefault();
          togglePlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        duration,
        currentTime,
        volume,
        queue,
        queueIndex,
        playTrack,
        pause,
        play,
        togglePlay,
        next,
        prev,
        seek,
        setVolume,
        addToQueue,
        setQueue,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
