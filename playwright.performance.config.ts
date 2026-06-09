import baseConfig from './playwright.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ...baseConfig,
  fullyParallel: false,
  workers: 1,
  grep: /@performance/,
  grepInvert: undefined,
  reporter: 'list',
});
