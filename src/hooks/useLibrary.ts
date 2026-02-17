import { useState, useEffect, useCallback } from 'react';
import manifestData from '../data/library/manifest.json';
import type { LibraryManifest, ParsedRepo, RepoManifestEntry } from '../adapters/types';

const manifest = manifestData as LibraryManifest;

const contentCache: Record<string, ParsedRepo> = {};

const emptyContent: ParsedRepo = { sections: [], exercises: [], totalItems: 0 };

async function loadRepoContent(repoId: string): Promise<ParsedRepo> {
  if (!repoId) return emptyContent;
  if (contentCache[repoId]) return contentCache[repoId];
  const mod = await import(`../data/library/${repoId}/content.json`);
  contentCache[repoId] = mod.default as ParsedRepo;
  return contentCache[repoId];
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
    contentCache[repoId] || emptyContent
  );
  const [loading, setLoading] = useState(!!repoId && !contentCache[repoId]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadRepoContent(repoId)
      .then(data => {
        if (!cancelled) { setContent(data); setLoading(false); }
      })
      .catch(() => {
        if (!cancelled) { setError('Failed to load content.'); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [repoId]);

  return { content, loading, error };
}
