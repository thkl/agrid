/**
 * Vitest global setup for the standalone (IDE) test runner.
 *
 * This mirrors the zoneless TestBed bootstrap that Angular's `@angular/build:unit-test` builder
 * generates internally (see its `init-testbed` virtual file), so tests behave the same whether run
 * via `ng test` (CLI/CI) or the VS Code Vitest extension (which uses `vitest.config.ts`).
 *
 * The app is zoneless (no zone.js dependency), so no zone import is needed here.
 */
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});
