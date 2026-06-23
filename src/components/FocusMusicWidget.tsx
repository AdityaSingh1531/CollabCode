'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Search,
  Music, Headphones, X, ChevronRight, Sliders, ListMusic
} from 'lucide-react';
import { useAudius, AudiusTrack } from '../hooks/useAudius';
import { useAudioPlayer } from '../context/AudioPlayerContext';

export default function FocusMusicWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AudiusTrack[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<AudiusTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'search'>('trending');
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.5);

  const { getTrending, searchTracks, isLoading: apiLoading } = useAudius();
  const {
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    volume,
    playTrack,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    queue,
  } = useAudioPlayer();

  // Load trending on mount
  useEffect(() => {
    getTrending().then((tracks) => {
      setTrendingTracks(tracks);
    });
  }, [getTrending]);

  // Handle search submit
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setActiveTab('search');
    const results = await searchTracks(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab('trending');
  };

  // Seek bar math
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  // Volume slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (newVol > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  // Helper to play from current listing
  const handleSelectTrack = (track: AudiusTrack, list: AudiusTrack[]) => {
    playTrack(track, list);
  };

  return (
    <div data-no-sound="true">
      {/* Collapsible Left Floating Trigger */}
      <div className="fixed left-0 top-[88%] z-45 transition-transform duration-300">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-2 pl-4 pr-3 py-3 rounded-r-2xl bg-surface-container-high border-y border-r border-outline-variant/40 shadow-2xl hover:bg-primary/10 hover:text-primary transition-all duration-300 group cursor-pointer"
            title="Focus Music Player"
          >
            <Headphones className={`w-5 h-5 text-on-surface group-hover:text-primary ${isPlaying ? 'animate-bounce' : ''}`} />
            <span className="max-w-0 overflow-hidden opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 transition-all duration-300 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
              Focus Music
            </span>
          </button>
        )}
      </div>

      {/* Main Glassmorphism Drawer */}
      <div
        onMouseLeave={() => setIsOpen(false)}
        className={`fixed inset-y-0 left-0 w-80 sm:w-96 glass-panel z-50 shadow-2xl transition-all duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <Headphones size={18} className={isPlaying ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h3 className="font-ui-header text-sm font-bold text-on-surface leading-tight">Focus Music</h3>
              <p className="text-[10px] text-outline">Powered by Audius</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface-container-highest/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <input
              type="text"
              placeholder="Search study tracks, lofi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container/60 border border-outline-variant/30 rounded-lg pl-8 pr-8 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all placeholder:text-outline/60"
            />
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-outline/60 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 p-0.5 rounded-full hover:bg-surface-container text-outline/80"
              >
                <X size={12} />
              </button>
            )}
          </form>
        </div>

        {/* Tab Selector */}
        <div className="flex px-3 border-b border-outline-variant/20 text-xs">
          <button
            onClick={() => setActiveTab('trending')}
            className={`flex-1 pb-2 font-semibold text-center border-b-2 transition-all ${activeTab === 'trending'
              ? 'border-primary text-primary'
              : 'border-transparent text-outline hover:text-on-surface-variant'
              }`}
          >
            Trending
          </button>
          <button
            onClick={() => {
              if (searchResults.length > 0) setActiveTab('search');
            }}
            disabled={searchResults.length === 0}
            className={`flex-1 pb-2 font-semibold text-center border-b-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${activeTab === 'search'
              ? 'border-primary text-primary'
              : 'border-transparent text-outline hover:text-on-surface-variant'
              }`}
          >
            Search Results ({searchResults.length})
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {apiLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-outline">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Resolving tracks...</span>
            </div>
          ) : (
            <>
              {activeTab === 'trending' ? (
                trendingTracks.length === 0 ? (
                  <div className="text-center py-10 text-outline text-xs">No trending tracks found.</div>
                ) : (
                  trendingTracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      isActive={currentTrack?.id === track.id}
                      isPlaying={isPlaying && currentTrack?.id === track.id}
                      onClick={() => handleSelectTrack(track, trendingTracks)}
                    />
                  ))
                )
              ) : (
                searchResults.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    isActive={currentTrack?.id === track.id}
                    isPlaying={isPlaying && currentTrack?.id === track.id}
                    onClick={() => handleSelectTrack(track, searchResults)}
                  />
                ))
              )}
            </>
          )}
        </div>

        {/* Bottom Audio Player controls */}
        {currentTrack && (
          <div className="p-3 bg-surface-container-high/80 border-t border-outline-variant/40 flex flex-col gap-2.5">
            {/* Metadata */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-surface-container overflow-hidden shrink-0 border border-outline-variant/40">
                {currentTrack.artwork?.['150x150'] ? (
                  <img
                    src={currentTrack.artwork['150x150']}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-outline">
                    <Music size={16} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-on-surface truncate pr-1">
                  {currentTrack.title}
                </div>
                <div className="text-[10px] text-outline truncate">
                  {currentTrack.user.name}
                </div>
              </div>

              {/* Equalizer animation */}
              {isPlaying && (
                <div className="flex items-end gap-[2px] h-3.5 w-4 pr-1">
                  <div className="w-[3px] bg-primary animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '0.8s' }} />
                  <div className="w-[3px] bg-primary animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.6s' }} />
                  <div className="w-[3px] bg-primary animate-bounce" style={{ animationDelay: '0s', animationDuration: '0.9s' }} />
                </div>
              )}
            </div>

            {/* Seek bar */}
            <div className="flex items-center gap-2 text-[9px] font-mono text-outline">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeekChange}
                className="flex-1 h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span>{formatTime(duration)}</span>
            </div>

            {/* Player Main Buttons & Volume */}
            <div className="flex items-center justify-between gap-2">
              {/* Left spacer for volume alignment */}
              <div className="flex items-center gap-1.5 w-[76px]">
                <button
                  onClick={toggleMute}
                  className="p-1 rounded-lg hover:bg-surface-container-highest/40 text-outline hover:text-on-surface transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-12 h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Core Control Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={prev}
                  className="p-1.5 rounded-full hover:bg-surface-container-highest/40 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <SkipBack size={14} fill="currentColor" />
                </button>
                <button
                  onClick={togglePlay}
                  className="p-2.5 rounded-full bg-primary text-on-primary hover:brightness-110 active:scale-95 shadow-md shadow-primary/20 transition-all flex items-center justify-center"
                >
                  {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="translate-x-[0.5px]" />}
                </button>
                <button
                  onClick={next}
                  className="p-1.5 rounded-full hover:bg-surface-container-highest/40 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <SkipForward size={14} fill="currentColor" />
                </button>
              </div>

              {/* Spacebar guide */}
              <div className="w-[76px] text-right text-[8px] font-semibold text-outline/50 uppercase tracking-widest select-none leading-none pr-1">
                Space = Play
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Track row item component
interface TrackRowProps {
  track: AudiusTrack;
  isActive: boolean;
  isPlaying: boolean;
  onClick: () => void;
}

function TrackRow({ track, isActive, isPlaying, onClick }: TrackRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${isActive
        ? 'bg-primary/10 border border-primary/20 text-primary'
        : 'bg-transparent border border-transparent hover:bg-surface-container-high/40 text-on-surface-variant'
        }`}
    >
      <div className="w-8 h-8 rounded bg-surface-container overflow-hidden shrink-0 border border-outline-variant/30 relative">
        {track.artwork?.['150x150'] ? (
          <img
            src={track.artwork['150x150']}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-outline">
            <Music size={12} />
          </div>
        )}
        {isActive && (
          <div className="absolute inset-0 bg-primary/25 flex items-center justify-center backdrop-blur-[1px]">
            {isPlaying ? (
              <Pause size={10} className="text-primary font-bold" fill="currentColor" />
            ) : (
              <Play size={10} className="text-primary font-bold" fill="currentColor" />
            )}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
          {track.title}
        </div>
        <div className="text-[10px] text-outline truncate">
          {track.user.name}
        </div>
      </div>
      <div className="text-[10px] font-mono text-outline shrink-0 pr-1">
        {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
      </div>
    </button>
  );
}
