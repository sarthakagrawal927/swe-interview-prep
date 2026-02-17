import { useState, useEffect, useCallback } from 'react';
import manifestData from '../data/library/manifest.json';
import type { LibraryManifest, ParsedRepo, RepoManifestEntry } from '../adapters/types';

const manifest = manifestData as LibraryManifest;

const contentCache: Record<string, ParsedRepo> = {};

async function loadRepoContent(repoId: string): Promise<ParsedRepo> {
  if (contentCache[repoId]) return contentCache[repoId];
  try {
    const mod = await import(`../data/library/${repoId}/content.json`);
    contentCache[repoId] = mod.default as ParsedRepo;
    return contentCache[repoId];
  } catch {
    return { sections: [], exercises: [], totalItems: 0 };
  }
}

export function useLibrary() {
  const repos = manifest.repos;

  const search = useCallback((query: string): RepoManifestEntry[] => {
    if (!query) return repos;
    const q = query.toLowerCase();
    return repos.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [repos]);

  const getRepo = useCallback((id: string): RepoManifestEntry | null => {
    return repos.find(r => r.id === id) || null;
  }, [repos]);

  return { repos, search, getRepo, generatedAt: manifest.generatedAt };
}

export function useRepoContent(repoId: string) {
  const [content, setContent] = useState<ParsedRepo>(
    contentCache[repoId] || { sections: [], exercises: [], totalItems: 0 }
  );
  const [loading, setLoading] = useState(!contentCache[repoId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadRepoContent(repoId).then(data => {
      if (!cancelled) {
        setContent(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [repoId]);

  return { content, loading };
}
