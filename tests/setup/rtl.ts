// React Testing Library global setup for Code Generation Step 24's component tests
// (tests/components/**). Registered via `vitest.config.mts`'s `test.setupFiles`, which
// means this file also loads for every pre-existing Step 10/15/18 module/API/repository
// test running under the default "node" environment — the `typeof document` guard below
// keeps it a no-op there (no DOM-only import side effects, no `afterEach` hook registered)
// rather than requiring a second, component-only Vitest project just to scope this file.
//
// What it does, only inside a jsdom-environment test file (one carrying a
// `// @vitest-environment jsdom` pragma):
//   1. Extends Vitest's `expect` with jest-dom's DOM matchers (`toBeInTheDocument`,
//      `toHaveTextContent`, etc.) via `@testing-library/jest-dom/vitest`.
//   2. Unmounts every component rendered by `@testing-library/react`'s `render()` after
//      each test (`cleanup()`), so one test's DOM tree never leaks into the next — the same
//      thing RTL's own auto-cleanup does when it can detect a global `afterEach`, done
//      explicitly here since this codebase's Vitest config does not set `test.globals: true`
//      (every existing test file imports `describe`/`it`/`expect`/etc. from "vitest"
//      explicitly, per `tests/modules/auth.test.ts`'s convention) and RTL's auto-detection
//      only recognizes an actual global.
import { afterEach } from "vitest";

if (typeof document !== "undefined") {
  const [{ cleanup }] = await Promise.all([
    import("@testing-library/react"),
    import("@testing-library/jest-dom/vitest"),
  ]);

  afterEach(() => {
    cleanup();
  });
}
