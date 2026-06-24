import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AgridComponent, AgridControl, AgridDataSource, ColDef } from '../agrid';
import { AgridProvider } from '../agrid/agrid-provider';
import { AGRID_EDITOR_CONTEXT } from '../agrid/editing/agrid-cell-editor';

/* ------------------------------------------------------------------ *
 * Custom editor 1 — star rating. Commits as soon as the user picks.
 * ------------------------------------------------------------------ */
@Component({
  selector: 'demo-star-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="star-editor" role="radiogroup" aria-label="Rating">
      @for (n of stars; track n) {
        <button
          #btn
          type="button"
          class="star"
          [class.star--on]="n <= preview()"
          [attr.aria-label]="n + ' stars'"
          (pointerenter)="preview.set(n)"
          (pointerleave)="preview.set(current())"
          (click)="pick(n)"
        >★</button>
      }
    </div>
  `,
  styles: `
    .star-editor { display: flex; align-items: center; height: 100%; gap: 2px; }
    .star { border: none; background: none; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 1px; color: #d0d7de; }
    .star--on { color: #f5b301; }
  `,
})
export class StarRatingEditor {
  private readonly ctx = inject(AGRID_EDITOR_CONTEXT);
  private readonly firstStar = viewChild<ElementRef<HTMLButtonElement>>('btn');
  readonly stars = [1, 2, 3, 4, 5];
  readonly current = signal(Number(this.ctx.value() ?? 0));
  readonly preview = signal(this.current());

  constructor() {
    afterNextRender(() => this.firstStar()?.nativeElement.focus());
  }

  pick(value: number): void {
    this.ctx.setDraft(value);
    this.ctx.commit();
  }
}

/* ------------------------------------------------------------------ *
 * Custom editor 2 — colour swatch picker. Commits on selection.
 * ------------------------------------------------------------------ */
const PRIORITY_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

@Component({
  selector: 'demo-color-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="swatch-editor">
      @for (c of palette; track c) {
        <button
          type="button"
          class="swatch"
          [class.swatch--on]="c === current()"
          [style.background-color]="c"
          [attr.aria-label]="c"
          (click)="pick(c)"
        ></button>
      }
    </div>
  `,
  styles: `
    .swatch-editor { display: flex; align-items: center; height: 100%; gap: 4px; padding: 0 2px; }
    .swatch { width: 16px; height: 16px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
    .swatch--on { border-color: #1f2328; }
  `,
})
export class ColorSwatchEditor {
  private readonly ctx = inject(AGRID_EDITOR_CONTEXT);
  readonly palette = PRIORITY_COLORS;
  readonly current = signal(String(this.ctx.value() ?? ''));

  pick(color: string): void {
    this.ctx.setDraft(color);
    this.ctx.commit();
  }
}

/* ------------------------------------------------------------------ *
 * Custom editor 3 — range slider. Stages drafts live, commits on
 * release (change) or when the user presses Enter / Tab (handled by
 * the grid). Escape cancels — both bubble to the grid for free.
 * ------------------------------------------------------------------ */
@Component({
  selector: 'demo-slider-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slider-editor">
      <input
        #range
        type="range"
        min="0"
        max="100"
        step="5"
        [value]="value()"
        (input)="onInput(range.value)"
        (change)="ctx.commit()"
      />
      <span class="slider-editor__value">{{ value() }}%</span>
    </div>
  `,
  styles: `
    .slider-editor { display: flex; align-items: center; height: 100%; gap: 6px; padding: 0 4px; }
    .slider-editor input { flex: 1; min-width: 0; }
    .slider-editor__value { width: 34px; text-align: right; font-size: 11px; color: #57606a; }
  `,
})
export class SliderEditor {
  readonly ctx = inject(AGRID_EDITOR_CONTEXT);
  private readonly range = viewChild<ElementRef<HTMLInputElement>>('range');
  readonly value = signal(Number(this.ctx.value() ?? 0));

  constructor() {
    afterNextRender(() => this.range()?.nativeElement.focus());
  }

  onInput(raw: string): void {
    const next = Number(raw);
    this.value.set(next);
    this.ctx.setDraft(next);
  }
}

/* ------------------------------------------------------------------ *
 * Display renderers (HTML-string cellRenderer) for the read state.
 * ------------------------------------------------------------------ */
function stars(value: number): string {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return `<span class="ce-stars">${'★'.repeat(n)}<span class="ce-stars__off">${'★'.repeat(5 - n)}</span></span>`;
}
function colorDot(value: string): string {
  return `<span class="ce-color"><span class="ce-color__dot" style="background:${value}"></span>${value}</span>`;
}
function progressBar(value: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return `<span class="ce-bar"><span class="ce-bar__fill" style="width:${pct}%"></span><span class="ce-bar__label">${pct}%</span></span>`;
}

const COLUMNS: ColDef[] = [
  { field: 'id', header: '#', width: 50, editable: false, locked: true },
  { field: 'task', header: 'Task', width: 220, filterable: true },
  {
    field: 'rating', header: 'Rating', width: 130, type: 'number',
    cellEditor: StarRatingEditor,
    cellRenderer: ({ value }) => stars(Number(value)),
  },
  {
    field: 'priority', header: 'Priority', width: 140,
    cellEditor: ColorSwatchEditor,
    cellRenderer: ({ value }) => colorDot(String(value)),
  },
  {
    field: 'progress', header: 'Progress', width: 200, type: 'number',
    cellEditor: SliderEditor,
    cellRenderer: ({ value }) => progressBar(Number(value)),
  },
];

const TASKS = [
  'Design system audit', 'Migrate auth service', 'Write API docs', 'Fix flaky tests',
  'Onboard new hire', 'Refactor billing', 'Ship dark mode', 'Reduce bundle size',
  'Accessibility pass', 'Database backups', 'Localize strings', 'Upgrade Angular',
];

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    task: TASKS[i % TASKS.length],
    rating: (i % 5) + 1,
    priority: PRIORITY_COLORS[i % PRIORITY_COLORS.length],
    progress: Math.round(((i * 17) % 100) / 5) * 5,
  }));
}

@Component({
  selector: 'demo-custom-editors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgridComponent],
  template: `
    <div class="demo-wrap">
      <div class="demo-header">
        <h2>Custom editors</h2>
        <span class="demo-meta">cellEditor · AGRID_EDITOR_CONTEXT · double-click a cell to edit</span>
      </div>
      <agrid class="demo-grid" [provider]="provider" />
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .demo-wrap { display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .demo-header { display: flex; align-items: baseline; gap: 12px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .demo-meta { font-size: 12px; color: #57606a; }
    .demo-grid { flex: 1; min-height: 0; }
    :host ::ng-deep .ce-stars { color: #f5b301; letter-spacing: 1px; }
    :host ::ng-deep .ce-stars__off { color: #d0d7de; }
    :host ::ng-deep .ce-color { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #57606a; }
    :host ::ng-deep .ce-color__dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    :host ::ng-deep .ce-bar { position: relative; display: flex; align-items: center; gap: 6px; width: 100%; }
    :host ::ng-deep .ce-bar__fill { height: 6px; border-radius: 3px; background: #3b82f6; flex: 0 0 auto; }
    :host ::ng-deep .ce-bar__label { font-size: 11px; color: #6c757d; }
  `],
})
export class CustomEditorsDemoComponent {
  readonly provider = new AgridProvider({
    columns: COLUMNS,
    datasource: new AgridDataSource(makeRows(12)),
    control: new AgridControl(),
    zebraStripes: true,
    showControlColumn: true,
    rowSelection: 'single',
  });

  readonly _grid = viewChild(AgridComponent);

  constructor() {
    afterNextRender(() => this._grid()?.autosizeAllColumns());
  }
}
