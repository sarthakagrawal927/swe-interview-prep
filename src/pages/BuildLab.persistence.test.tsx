// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BuildLab from './BuildLab';
import { DRILL_BY_ID } from '../data/learning-os';
import { STORE_KEYS } from '../lib/userStore';

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../components/CodeEditor', () => ({
  default: ({ code, onChange }: { code: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Solution"
      value={code}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock('../components/FeynmanGate', () => ({ default: () => null }));
vi.mock('../components/FeynmanNudge', () => ({ default: () => null }));
vi.mock('../hooks/useConcepts', () => ({
  useConceptMastery: () => ({ mastery: {}, refresh: vi.fn(), review: vi.fn() }),
}));
vi.mock('../hooks/useReviewMastery', () => ({
  useReviewMastery: () => ({ mastery: {}, review: vi.fn() }),
}));
vi.mock('../hooks/useActivity', () => ({ useActivityLogger: () => vi.fn() }));
vi.mock('../hooks/useCodeExecution', () => ({
  useCodeExecution: () => ({ output: '', errors: '', isRunning: false, execute: vi.fn() }),
}));
vi.mock('../hooks/useUserStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useUserStore')>()),
  useUserElo: () => ({ recordResult: vi.fn() }),
}));

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

const drill = DRILL_BY_ID['build-tokenizer'];
const nextDrill = Object.values(DRILL_BY_ID).find(
  (item) => item.id !== drill.id && item.testCases?.length
)!;

function click(element: Element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function typeCode(element: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
    element,
    value
  );
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('drill grading and saved exercise resume', () => {
  let container: HTMLDivElement;
  let root: Root;
  const editor = () => container.querySelector('textarea')!;
  const solve = () =>
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Mark solved')
    )!;

  async function render() {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={[`/build/${drill.id}`]}>
          <Link to={`/build/${nextDrill.id}`}>Next exercise</Link>
          <Routes>
            <Route path="/build/:id" element={<BuildLab />} />
          </Routes>
        </MemoryRouter>
      )
    );
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    storage.clear();
    auth.user = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('rejects a wrong solution, grades actual reference code, then restores saved completion after remount', async () => {
    await render();
    await act(async () => click(solve()));
    expect(storage.has(STORE_KEYS.drills)).toBe(false);
    expect(container.textContent).not.toContain('All tests passed.');
    await act(async () => typeCode(editor(), drill.referenceSolution!));
    await act(async () => click(solve()));
    const saved = JSON.parse(storage.get(STORE_KEYS.drills)!)[drill.id];
    expect(saved).toEqual({ status: 'solved', lastCode: drill.referenceSolution, attempts: 1 });
    expect(container.textContent).toContain('All tests passed.');
    await act(async () => root.unmount());
    root = createRoot(container);
    await render();
    expect(editor().value).toBe(drill.referenceSolution);
    expect(container.textContent).toContain('solved');
  });

  it('starts the next exercise with its own editor rather than the previous solution', async () => {
    await render();
    await act(async () => typeCode(editor(), 'const previousExercise = true;'));
    await act(async () =>
      click(
        [...container.querySelectorAll('a')].find((link) => link.textContent === 'Next exercise')!
      )
    );
    expect(editor().value).not.toContain('previousExercise');
    expect(container.textContent).toContain(nextDrill.title);
  });

  it('hydrates account code received after mount without overwriting a learner edit', async () => {
    auth.user = { id: 'test-learner' };
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );
    await render();
    await act(async () =>
      resolveFetch(
        Response.json({
          drills: {
            [drill.id]: { status: 'solved', attempts: 1, lastCode: drill.referenceSolution },
          },
        })
      )
    );
    expect(editor().value).toBe(drill.referenceSolution);
    await act(async () => root.unmount());
    root = createRoot(container);
    storage.clear();
    await render();
    await act(async () => typeCode(editor(), ''));
    await act(async () =>
      resolveFetch(
        Response.json({
          drills: {
            [drill.id]: { status: 'solved', attempts: 1, lastCode: drill.referenceSolution },
          },
        })
      )
    );
    expect(editor().value).toBe('');
  });
});
