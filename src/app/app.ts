import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { DEMO_GUIDE_BY_PATH, DEMO_GUIDES, DemoGuide } from './demo-catalog';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  readonly theme = inject(ThemeService);
  readonly demos = DEMO_GUIDES;
  readonly currentPath = signal(this.pathFromUrl(this.router.url));
  readonly currentDemo = computed<DemoGuide | null>(
    () => DEMO_GUIDE_BY_PATH.get(this.currentPath()) ?? null,
  );
  readonly copied = signal(false);
  private copyResetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(event => {
        this.currentPath.set(this.pathFromUrl(event.urlAfterRedirects));
        this.copied.set(false);
      });
  }

  openDemo(event: Event): void {
    const path = (event.target as HTMLSelectElement).value;
    if (path) void this.router.navigateByUrl(path);
  }

  async copyDemoCode(): Promise<void> {
    const code = this.currentDemo()?.code;
    if (!code || !navigator.clipboard) return;

    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    clearTimeout(this.copyResetTimer);
    this.copyResetTimer = setTimeout(() => this.copied.set(false), 1600);
  }

  private pathFromUrl(url: string): string {
    return url.split(/[?#]/, 1)[0] || '/';
  }
}
