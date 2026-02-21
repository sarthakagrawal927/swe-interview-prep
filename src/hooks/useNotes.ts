import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth, getAuthToken } from '../contexts/AuthContext';

const LOCAL_NOTES_KEY = 'dsa-prep-notes';
const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

function loadLocalNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalNotes(all: Record<string, string>) {
  localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(all));
}

export function useNotes(problemId: string | undefined) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load notes when problem changes
  useEffect(() => {
    if (!problemId) return;

    if (user) {
      // Signed in: load from backend API
      const token = getAuthToken();
      if (!token) return;

      fetch(`${API_URL}/api/notes?problemId=${problemId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          setNotes(data.notes || '');
        })
        .catch(err => console.error('Failed to load notes:', err));
    } else {
      // Guest: load from localStorage
      const all = loadLocalNotes();
      setNotes(all[problemId] || '');
    }
  }, [user, problemId]);

  const saveNotes = useCallback((value: string) => {
    setNotes(value);
    if (!problemId) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (user) {
        // Signed in: save to backend API
        const token = getAuthToken();
        if (!token) return;

        fetch(`${API_URL}/api/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ problemId, notes: value }),
        }).catch(err => console.error('Failed to save notes:', err));
      } else {
        // Guest: save to localStorage
        const all = loadLocalNotes();
        all[problemId] = value;
        saveLocalNotes(all);
      }
    }, 500);
  }, [user, problemId]);

  return { notes, saveNotes };
}
