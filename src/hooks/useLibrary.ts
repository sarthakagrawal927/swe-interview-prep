import { useState, useEffect, useCallback } from 'react';
import manifestData from '../data/library/manifest.json';
import type { LibraryManifest, ParsedRepo, RepoManifestEntry } from '../adapters/types';
import { scoreExerciseQuality } from '../lib/questionQuality';
import { deriveExercisesFromSections } from '../lib/readmeExerciseExtractor';

const manifest = manifestData as LibraryManifest;

const contentCache: Record<string, ParsedRepo> = {};

const emptyContent: ParsedRepo = { sections: [], exercises: [], totalItems: 0 };

function enrichExercises(repoId: string, data: ParsedRepo): ParsedRepo {
  const repoMeta = manifest.repos.find(r => r.id === repoId);
  const baseTags = repoMeta?.tags || [];

  const existing = (data.exercises || []).map(exercise => {
    if (exercise.qualityScore !== undefined && exercise.qualityTier) return exercise;
    const quality = scoreExerciseQuality(exercise);
    return {
      ...exercise,
      qualityScore: quality.score,
      qualityTier: quality.tier,
      qualitySignals: quality.signals,
    };
  });

  const highQualityExisting = existing.filter(e => (e.qualityScore || 0) >= 72).length;
  const hasStrongCoverage =
    existing.length >= 30 && highQualityExisting / Math.max(existing.length, 1) >= 0.55;

  const generated = hasStrongCoverage
    ? []
    : deriveExercisesFromSections(data.sections, {
        baseTags,
        maxExercises: 70,
        minScore: 70,
      });

  const deduped = new Map<string, (typeof existing)[number]>();
  for (const item of [...existing, ...generated]) {
    const key = item.question.trim().toLowerCase();
    if (!deduped.has(key)) deduped.set(key, item);
  }

  const merged = Array.from(deduped.values());
  return {
    ...data,
    exercises: merged,
    totalItems: data.sections.length + merged.length,
  };
}

async function loadRepoContent(repoId: string): Promise<ParsedRepo> {
  if (!repoId) return emptyContent;
  if (contentCache[repoId]) return contentCache[repoId];
  const mod = await import(`../data/library/${repoId}/content.json`);
  const enriched = enrichExercises(repoId, mod.default as ParsedRepo);
  contentCache[repoId] = enriched;
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
