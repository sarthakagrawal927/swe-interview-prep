import { activateRecordAccount, getRecordStore, type RecordSyncConfig } from '../lib/recordSync';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { learningFetch } from '../lib/learningApi';
import type { ArtifactStatus, DrillStatus, ProjectStatus } from '../data/learning-os';
import { DEFAULT_USER_ELO, updatePlayerElo } from '../lib/elo';
import { loadLocal, type MergeableNote, mergeNotes, saveLocal, STORE_KEYS } from '../lib/userStore';

// ---------------------------------------------------------------------------
// Generic record store: localStorage-first, DB-synced when signed in.
// ---------------------------------------------------------------------------

function useRecordStore<T>(config: RecordSyncConfig<T>) {
  const { user, loading } = useAuth();
  const store = getRecordStore(config, user?.id ?? null);
  useEffect(() => activateRecordAccount(loading ? null : (user?.id ?? null)), [user?.id, loading]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return {
    data: snapshot.data,
    set: (id: string, entry: T | ((previous: T | undefined) => T)) => store.set(id, entry),
    syncStatus: snapshot.status,
    syncError: snapshot.error,
    retrySync: store.retry,
  };
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export interface ArtifactEntry {
  status: ArtifactStatus;
  url: string;
  path: string;
  notes: string;
  criteria: number[];
}

const EMPTY_ARTIFACT: ArtifactEntry = {
  status: 'todo',
  url: '',
  path: '',
  notes: '',
  criteria: [],
};

const ARTIFACT_CONFIG: RecordSyncConfig<ArtifactEntry> = {
  localKey: STORE_KEYS.artifacts,
  action: 'artifacts',
  field: 'artifacts',
  toPayload: (artifactId, e) => ({ artifactId, ...e }),
};

export function useArtifactStore() {
  const { data, set, ...sync } = useRecordStore<ArtifactEntry>(ARTIFACT_CONFIG);
  return {
    ...sync,
    artifacts: data,
    getArtifact: (id: string): ArtifactEntry => data[id] || EMPTY_ARTIFACT,
    setArtifact: set,
  };
}

// ---------------------------------------------------------------------------
// Drills
// ---------------------------------------------------------------------------

export interface DrillEntry {
  status: DrillStatus;
  lastCode: string;
  attempts: number;
}

const EMPTY_DRILL: DrillEntry = { status: 'unsolved', lastCode: '', attempts: 0 };

const DRILL_CONFIG: RecordSyncConfig<DrillEntry> = {
  localKey: STORE_KEYS.drills,
  action: 'drills',
  field: 'drills',
  toPayload: (drillId, e) => ({ drillId, status: e.status, lastCode: e.lastCode }),
};

export function useDrillStore() {
  const { data, set, ...sync } = useRecordStore<DrillEntry>(DRILL_CONFIG);
  return {
    ...sync,
    drills: data,
    getDrill: (id: string): DrillEntry => data[id] || EMPTY_DRILL,
    setDrill: (id: string, entry: DrillEntry) =>
      set(id, (previous) => ({ ...entry, attempts: (previous?.attempts || 0) + 1 })),
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ProjectEntry {
  status: ProjectStatus;
  nextAction: string;
  milestones: Record<string, boolean>;
}

const PROJECT_CONFIG: RecordSyncConfig<ProjectEntry> = {
  localKey: STORE_KEYS.projects,
  action: 'projects',
  field: 'projects',
  toPayload: (projectId, e) => ({ projectId, ...e }),
};

export function useProjectStore() {
  const { data, set, ...sync } = useRecordStore<ProjectEntry>(PROJECT_CONFIG);
  return { ...sync, projects: data, getProject: (id: string) => data[id], setProject: set };
}

// ---------------------------------------------------------------------------
// Notes — a list store, not a record store.
// ---------------------------------------------------------------------------

export interface LearningNote extends MergeableNote {
  id: string;
  scope: 'concept' | 'roadmap' | 'project' | 'free';
  refId: string;
  title: string;
  body: string;
  updatedAt: string;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function useLearningNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<LearningNote[]>(() => loadLocal(STORE_KEYS.notes, []));

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/learning?action=notes', { credentials: 'include' });
      if (!res.ok) return;
      const d = await res.json();
      const merged = mergeNotes(loadLocal<LearningNote[]>(STORE_KEYS.notes, []), d.notes || []);
      setNotes(merged);
      saveLocal(STORE_KEYS.notes, merged);
    } catch {
      // Offline / no endpoint — keep localStorage state.
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNote = useCallback(
    (note: Partial<LearningNote> & { scope: LearningNote['scope']; body: string }) => {
      const full: LearningNote = {
        id: note.id || newId(),
        scope: note.scope,
        refId: note.refId || '',
        title: note.title || '',
        body: note.body,
        updatedAt: new Date().toISOString(),
      };
      setNotes((prev) => {
        const next = mergeNotes(
          prev.filter((n) => n.id !== full.id),
          [full]
        );
        saveLocal(STORE_KEYS.notes, next);
        return next;
      });
      if (user) {
        void fetch('/api/learning?action=notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(full),
        }).catch(() => {});
      }
      return full;
    },
    [user]
  );

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        saveLocal(STORE_KEYS.notes, next);
        return next;
      });
      if (user) {
        void fetch(`/api/learning?action=notes&id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => {});
      }
    },
    [user]
  );

  return { notes, saveNote, deleteNote };
}

// ---------------------------------------------------------------------------
// Focus mode — no-tools audit. Hides AI assistance from Playground.
// Tracks each toggle-on transition as a "session" so weekly counts surface
// how often the user actually trains without scaffolding.
// localStorage-only for v1; not synced to DB.
// ---------------------------------------------------------------------------

interface FocusModeState {
  enabled: boolean;
  // Unix ms timestamps of each toggle-on transition. Truncated to last 90 days.
  sessions: number[];
}

const EMPTY_FOCUS: FocusModeState = { enabled: false, sessions: [] };
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function useFocusMode() {
  const [state, setState] = useState<FocusModeState>(() =>
    loadLocal<FocusModeState>(STORE_KEYS.focusMode, EMPTY_FOCUS)
  );

  const setEnabled = useCallback((next: boolean) => {
    setState((prev) => {
      const now = Date.now();
      const sessions = prev.sessions.filter((t) => now - t < NINETY_DAYS_MS);
      // Log a session only on the off → on transition.
      if (next && !prev.enabled) sessions.push(now);
      const updated = { enabled: next, sessions };
      saveLocal(STORE_KEYS.focusMode, updated);
      return updated;
    });
  }, []);

  // Returned as a function so Date.now() — an impure call — happens at the
  // consumer's read site rather than during this hook's render. The count
  // is naturally bounded by the 7-day window in the filter.
  const sessionsThisWeek = useCallback(
    () => state.sessions.filter((t) => Date.now() - t < SEVEN_DAYS_MS).length,
    [state.sessions]
  );

  return { enabled: state.enabled, setEnabled, sessionsThisWeek };
}

// ---------------------------------------------------------------------------
// Per-roadmap user ELO — adaptive difficulty calibration.
// Problem ratings come from `difficultyToElo` (static); only the player's
// ELO moves. K-factor is elevated during the first ~10 solves per roadmap
// for faster convergence. localStorage-only for v1.
//
// Pre-tags-migration the keys here were track IDs. Old state is detected
// and reset on first read — ELO recovers in 5-10 drill solves anyway.
// ---------------------------------------------------------------------------

interface UserEloState {
  // Per-roadmap ELO. Missing roadmaps default to DEFAULT_USER_ELO.
  elo: Record<string, number>;
  // Per-roadmap solve counter used to scale K-factor (provisional vs stable).
  solves: Record<string, number>;
  // Schema version — bumped to invalidate per-track state.
  v?: 2;
}

const EMPTY_USER_ELO: UserEloState = { elo: {}, solves: {}, v: 2 };

function loadElo(): UserEloState {
  const raw = loadLocal<UserEloState>(STORE_KEYS.userElo, EMPTY_USER_ELO);
  if (raw.v === 2) return raw;
  // Legacy state — keys were track IDs. Drop it; ELO is soft and will reconverge.
  const fresh = { ...EMPTY_USER_ELO };
  saveLocal(STORE_KEYS.userElo, fresh);
  return fresh;
}

function syncEloToDb(state: UserEloState) {
  // Skipped entirely for guests — ELO lives in localStorage for them.
  void learningFetch('elo', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  }).catch(() => {});
}

export function useUserElo() {
  const [state, setState] = useState<UserEloState>(loadElo);

  useEffect(() => {
    // Resolves null for guests, so no request is made and nothing 401s.
    void learningFetch('elo')
      .then((r) => r?.json())
      .then((data) => {
        if (!data) return;
        if (data.state?.v === 2) {
          setState((prev) => {
            const merged = {
              elo: { ...prev.elo, ...data.state.elo },
              solves: { ...prev.solves, ...data.state.solves },
              v: 2 as const,
            };
            saveLocal(STORE_KEYS.userElo, merged);
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  const getElo = useCallback(
    (roadmapId: string): number => state.elo[roadmapId] ?? DEFAULT_USER_ELO,
    [state.elo]
  );

  /** Record a drill result against every roadmap the concept belongs to. */
  const recordResult = useCallback((roadmapIds: string[], problemElo: number, score: number) => {
    if (!roadmapIds.length) return;
    setState((prev) => {
      const elo = { ...prev.elo };
      const solves = { ...prev.solves };
      for (const rid of roadmapIds) {
        const current = elo[rid] ?? DEFAULT_USER_ELO;
        const solveCount = solves[rid] ?? 0;
        elo[rid] = updatePlayerElo(current, problemElo, score, solveCount);
        solves[rid] = solveCount + 1;
      }
      const next: UserEloState = { elo, solves, v: 2 };
      saveLocal(STORE_KEYS.userElo, next);
      syncEloToDb(next);
      return next;
    });
  }, []);

  return { getElo, recordResult, elo: state.elo, solves: state.solves };
}
