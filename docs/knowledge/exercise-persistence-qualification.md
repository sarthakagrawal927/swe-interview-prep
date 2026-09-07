# Exercise persistence qualification — 2026-09-07

The source repair fixes two reproducible resume defects in the drill workspace:
changing the drill route retained the previous exercise's draft, and saved code
arriving after mount never replaced the initial starter. Each drill now owns a
separate workspace instance; an untouched editor follows saved progress until
the learner edits, including an intentional empty draft.

## Executable evidence

`src/pages/BuildLab.persistence.test.tsx` mounts the real BuildLab React route,
real authored `build-tokenizer` test cases, real TypeScript drill grader and
real local drill-store hook.

- The starter/wrong implementation cannot be marked solved or write completion.
- The authored reference implementation passes actual tests, stores solved
  status/code/one attempt, and restores them after unmount/remount.
- Navigating to another real drill clears the previous exercise's draft.
- Delayed account code fills an untouched editor, while an edited empty buffer
  remains empty when the same response arrives later.

The last two cases fail on the original source and pass on the repair. The
complete local `pnpm quality` gate passes: 598 tests across 93 files, coverage
floors, code health, docs, production build and bundle-size checks. The final
act-environment test setting was checked with the three interaction tests.

## Limits and retained tasks

This DOM harness substitutes a textarea for Monaco, mocks authentication and
hosted read responses, and stubs mastery/AI/activity side effects. It exercises
real grading and local persistence, not the actual browser editor, Google
login, D1 writes or the full explain-back flow. No existing learner data was
read or changed, and no deployment occurred.

- [#97: live exercise/account qualification](https://github.com/Significant-Hobbies/swe-interview-prep/issues/97)
  retains the fresh guest, mobile, Monaco and hosted persistence gates.
- [#98: unsynced local edit reconciliation](https://github.com/Significant-Hobbies/swe-interview-prep/issues/98)
  tracks the existing generic store's remote-wins behavior after failed or
  pending writes. This repair does not claim offline/account synchronization
  reliability.

The September task inventory contained zero open Issues or PRs. No closures
were justified; the two issues above preserve concrete remaining work.
