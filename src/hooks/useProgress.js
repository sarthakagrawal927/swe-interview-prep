import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dsa-prep-progress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress);

  const getStatus = useCallback((problemId) => {
    return progress[problemId]?.status || 'unseen';
  }, [progress]);

  const updateStatus = useCallback((problemId, status) => {
    setProgress(prev => {
      const next = {
        ...prev,
        [problemId]: {
          ...prev[problemId],
          status,
          lastAttempted: new Date().toISOString(),
        },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const getNotes = useCallback((problemId) => {
    return progress[problemId]?.notes || '';
  }, [progress]);

  const saveNotes = useCallback((problemId, notes) => {
    setProgress(prev => {
      const next = {
        ...prev,
        [problemId]: {
          ...prev[problemId],
          notes,
        },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback((problemId) => {
    return progress[problemId]?.bookmarked || false;
  }, [progress]);

  const toggleBookmark = useCallback((problemId) => {
    setProgress(prev => {
      const next = {
        ...prev,
        [problemId]: {
          ...prev[problemId],
          bookmarked: !prev[problemId]?.bookmarked,
        },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  const getSavedCode = useCallback((problemId) => {
    return progress[problemId]?.code || null;
  }, [progress]);

  const getSavedLanguage = useCallback((problemId) => {
    return progress[problemId]?.language || 'javascript';
  }, [progress]);

  const saveCode = useCallback((problemId, code, language) => {
    setProgress(prev => {
      const next = {
        ...prev,
        [problemId]: {
          ...prev[problemId],
          code,
          language,
        },
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

  return {
    progress,
    getStatus,
    updateStatus,
    getNotes,
    saveNotes,
    getSavedCode,
    getSavedLanguage,
    saveCode,
    isBookmarked,
    toggleBookmark,
    getStats,
  };
}
