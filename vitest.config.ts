/// <reference types="vitest" />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

/**
 * Standalone Vitest config for IDE integration (VS Code "Testing" pane + coverage gutters).
 *
 * The project's source of truth for CI is the Angular `@angular/build:unit-test` builder
 * (`pnpm test` / `pnpm test:coverage`), which generates its own Vitest config at runtime. The
 * VS Code Vitest extension can't see that generated config, so this file recreates an equivalent
 * environment for the extension: the AnalogJS Angular plugin compiles components/templates, jsdom
 * provides the DOM, `globals` provides `describe`/`it`/`expect`, and `src/test-setup.ts` bootstraps
 * the (zoneless) Angular TestBed exactly as the builder does.
 *
 * Keep test behavior in sync with the builder; CI should continue to run `pnpm test`.
 */
export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts', 'src/main.ts', 'src/test-setup.ts'],
      reporter: ['text', 'html'],
    },
  },
});
