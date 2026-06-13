import { DestroyRef, Injectable, inject, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'agrid-theme';
const LEGACY_THEME_STORAGE_KEY = 'agrid-home-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly colorScheme =
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? null
      : window.matchMedia('(prefers-color-scheme: dark)');

  readonly darkMode = signal(this.getInitialDarkMode());

  constructor() {
    if (!this.colorScheme) return;

    const onColorSchemeChange = (event: MediaQueryListEvent): void => {
      if (this.hasStoredPreference()) return;
      this.darkMode.set(event.matches);
    };

    this.colorScheme.addEventListener('change', onColorSchemeChange);
    this.destroyRef.onDestroy(() =>
      this.colorScheme?.removeEventListener('change', onColorSchemeChange),
    );
  }

  toggle(): void {
    this.setDarkMode(!this.darkMode());
  }

  setDarkMode(darkMode: boolean): void {
    this.darkMode.set(darkMode);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    } catch {
      // The selected mode still applies for the current session.
    }
  }

  private getInitialDarkMode(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const storedTheme =
        window.localStorage.getItem(THEME_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
      if (storedTheme) return storedTheme === 'dark';
    } catch {
      // Fall back to the browser preference in restricted browsing contexts.
    }

    return this.colorScheme?.matches ?? false;
  }

  private hasStoredPreference(): boolean {
    try {
      return Boolean(
        window.localStorage.getItem(THEME_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY),
      );
    } catch {
      return false;
    }
  }
}
