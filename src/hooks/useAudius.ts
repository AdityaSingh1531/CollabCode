'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre: string;
  description?: string;
  artwork?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
  user: {
    name: string;
    handle: string;
  };
  streamUrl: string;
}

let sharedNodeUrl = 'https://discoveryprovider.audius.co';
let isInitializingNode = false;
const nodeListeners: ((node: string) => void)[] = [];

async function getHealthyNode(): Promise<string> {
  if (sharedNodeUrl && sharedNodeUrl !== 'https://discoveryprovider.audius.co') {
    return sharedNodeUrl;
  }
  if (isInitializingNode) {
    return new Promise((resolve) => {
      nodeListeners.push(resolve);
    });
  }
  isInitializingNode = true;
  try {
    const res = await fetch('https://api.audius.co');
    const data = await res.json();
    if (data && data.data && data.data.length > 0) {
      const nodes = data.data;
      // Pick a random node from the list
      sharedNodeUrl = nodes[Math.floor(Math.random() * nodes.length)];
    }
  } catch (e) {
    console.error('Failed to resolve healthy Audius node, using fallback', e);
  }
  isInitializingNode = false;
  nodeListeners.forEach((resolve) => resolve(sharedNodeUrl));
  return sharedNodeUrl;
}

export function useAudius() {
  const [nodeUrl, setNodeUrl] = useState<string>(sharedNodeUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    getHealthyNode().then((url) => setNodeUrl(url));
  }, []);

  const formatTrack = useCallback((track: any, baseUrl: string): AudiusTrack => {
    return {
      id: track.id,
      title: track.title,
      duration: track.duration,
      genre: track.genre,
      description: track.description,
      artwork: track.artwork,
      user: {
        name: track.user?.name || 'Unknown Artist',
        handle: track.user?.handle || 'unknown',
      },
      streamUrl: `${baseUrl}/v1/tracks/${track.id}/stream?app_name=COLLABCODE_FOCUS`,
    };
  }, []);

  const getTrending = useCallback(async (): Promise<AudiusTrack[]> => {
    setIsLoading(true);
    try {
      const baseUrl = await getHealthyNode();
      // Fetch trending lofi / ambient / focus-like electronic music if possible
      const res = await fetch(`${baseUrl}/v1/tracks/trending?genre=Ambient&app_name=COLLABCODE_FOCUS`);
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        if (data.data.length > 0) {
          return data.data.map((track: any) => formatTrack(track, baseUrl));
        }
      }
      
      // Fallback to general trending if no Ambient tracks found
      const fallbackRes = await fetch(`${baseUrl}/v1/tracks/trending?app_name=COLLABCODE_FOCUS`);
      const fallbackData = await fallbackRes.json();
      if (fallbackData && Array.isArray(fallbackData.data)) {
        return fallbackData.data.map((track: any) => formatTrack(track, baseUrl));
      }
    } catch (e) {
      console.error('Error fetching trending tracks:', e);
    } finally {
      setIsLoading(false);
    }
    return [];
  }, [formatTrack]);

  const searchTracks = useCallback(async (query: string): Promise<AudiusTrack[]> => {
    if (!query.trim()) return [];
    setIsLoading(true);
    try {
      const baseUrl = await getHealthyNode();
      const res = await fetch(`${baseUrl}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=COLLABCODE_FOCUS`);
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        return data.data.map((track: any) => formatTrack(track, baseUrl));
      }
    } catch (e) {
      console.error('Error searching tracks:', e);
    } finally {
      setIsLoading(false);
    }
    return [];
  }, [formatTrack]);

  return {
    nodeUrl,
    isLoading,
    getTrending,
    searchTracks,
  };
}
