import { useState, useCallback } from 'react';
import type { Progress, Language } from '../types';

const STORAGE_KEY = 'dsa-prep-progress';

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: Progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(loadProgress);

  const getStatus = useCallback((problemId: string): string => {
    return progress[problemId]?.status || 'unseen';
  }, [progress]);

  const updateStatus = useCallback((problemId: string, status: string) => {
    setProgress(prev => {
      const next: Progress = {
        ...prev,
        [problemId]: { ...prev[problemId], status, lastAttempted: new Date().toISOString() },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const getNotes = useCallback((problemId: string): string => {
    return progress[problemId]?.notes || '';
  }, [progress]);

  const saveNotes = useCallback((problemId: string, notes: string) => {
    setProgress(prev => {
      const next: Progress = { ...prev, [problemId]: { ...prev[problemId], notes } };
      saveProgress(next);
      return next;
    });
  }, []);

  const getSavedCode = useCallback((problemId: string): string | null => {
    return progress[problemId]?.code || null;
  }, [progress]);

  const getSavedLanguage = useCallback((problemId: string): Language => {
    return (progress[problemId]?.language as Language) || 'typescript';
  }, [progress]);

  const saveCode = useCallback((problemId: string, code: string, language: Language) => {
    setProgress(prev => {
      const next: Progress = { ...prev, [problemId]: { ...prev[problemId], code, language } };
      saveProgress(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback((problemId: string): boolean => {
    return progress[problemId]?.bookmarked || false;
  }, [progress]);

  const toggleBookmark = useCallback((problemId: string) => {
    setProgress(prev => {
      const next: Progress = {
        ...prev,
        [problemId]: { ...prev[problemId], bookmarked: !prev[problemId]?.bookmarked },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const getStats = useCallback(() => {
    const values = Object.values(progress);
    return {
      total: values.length,
      solved: values.filter(v => v.status === 'solved' || v.status === 'mastered').length,
      attempted: values.filter(v => v.status === 'attempted').length,
      mastered: values.filter(v => v.status === 'mastered').length,
    };
  }, [progress]);

  return { progress, getStatus, updateStatus, getNotes, saveNotes, getSavedCode, getSavedLanguage, saveCode, isBookmarked, toggleBookmark, getStats };
}
