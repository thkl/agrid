import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AGRID_LOCALE_TEXT,
  resolveAgridLocaleText,
  resolveLocale,
} from './agrid-localization';

describe('resolveLocale', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns an explicitly configured locale unchanged', () => {
    expect(resolveLocale('de-DE')).toBe('de-DE');
  });

  it('resolves auto to the browser locale', () => {
    vi.stubGlobal('navigator', { language: 'fr-CA' });

    expect(resolveLocale('auto')).toBe('fr-CA');
  });

  it('falls back to English when navigator is unavailable', () => {
    vi.stubGlobal('navigator', undefined);

    expect(resolveLocale('auto')).toBe('en-US');
  });
});

describe('resolveAgridLocaleText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('selects the built-in English and German locale text', () => {
    expect(resolveAgridLocaleText('en-GB', new Map()).save).toBe('Save');
    expect(resolveAgridLocaleText('de-DE', new Map()).save).toBe('Speichern');
  });

  it('resolves an undefined locale through the browser locale', () => {
    vi.stubGlobal('navigator', { language: 'de-AT' });

    expect(resolveAgridLocaleText(undefined, new Map()).save).toBe('Speichern');
  });

  it('matches exact custom locales case-insensitively and retains base values', () => {
    const result = resolveAgridLocaleText(
      'fr-CA',
      new Map([['FR-ca', { save: 'Enregistrer' }]]),
    );

    expect(result.save).toBe('Enregistrer');
    expect(result.close).toBe('Close');
  });

  it('falls back to a matching primary-language override', () => {
    const result = resolveAgridLocaleText(
      'fr-CA',
      new Map([['fr', { save: 'Enregistrer' }]]),
    );

    expect(result.save).toBe('Enregistrer');
  });

  it('prefers an exact override over an earlier primary-language match', () => {
    const result = resolveAgridLocaleText(
      'fr-CA',
      new Map([
        ['fr-FR', { save: 'Enregistrer' }],
        ['FR-ca', { save: 'Sauvegarder' }],
      ]),
    );

    expect(result.save).toBe('Sauvegarder');
  });

  it('ignores unrelated custom locales', () => {
    const result = resolveAgridLocaleText(
      'en-US',
      new Map([['fr', { save: 'Enregistrer' }]]),
    );

    expect(result.save).toBe('Save');
  });
});

describe('built-in locale text factories', () => {
  it('formats English and German row counts', () => {
    expect(AGRID_LOCALE_TEXT.en.rows(1)).toBe('1 row');
    expect(AGRID_LOCALE_TEXT.en.rows(2)).toBe('2 rows');
    expect(AGRID_LOCALE_TEXT.de.rows(1)).toBe('1 Zeile');
    expect(AGRID_LOCALE_TEXT.de.rows(2)).toBe('2 Zeilen');
  });

  it('formats English and German group labels', () => {
    expect(AGRID_LOCALE_TEXT.en.groupBy('Country')).toBe('Group by Country');
    expect(AGRID_LOCALE_TEXT.de.groupBy('Land')).toBe('Nach Land gruppieren');
  });
});
