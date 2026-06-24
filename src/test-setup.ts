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

class TestResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    const entry = {
      target,
      contentRect: target.getBoundingClientRect(),
    } as ResizeObserverEntry;
    this.callback([entry], this);
  }

  unobserve(): void {}

  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: TestResizeObserver,
  });
}

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});
