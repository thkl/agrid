import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AgridCellComponent } from './agrid-cell.component';

describe('AgridCellComponent custom renderer', () => {
  let fixture: ComponentFixture<AgridCellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgridCellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridCellComponent);
    fixture.componentRef.setInput('rowIndex', 0);
    fixture.componentRef.setInput('colIndex', 0);
    fixture.componentRef.setInput('value', 'Active');
    fixture.componentRef.setInput('row', { status: 'Active' });
  });

  afterEach(() => fixture.destroy());

  it('sanitizes custom renderer HTML while preserving safe markup', () => {
    fixture.componentRef.setInput('col', {
      field: 'status',
      header: 'Status',
      cellRenderer: () =>
        '<span class="badge" onclick="window.compromised=true">Active</span>' +
        '<script>window.compromised=true</script>',
    });

    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.ag-cell-value') as HTMLElement;
    expect(value.querySelector('.badge')?.textContent).toBe('Active');
    expect(value.querySelector('.badge')?.hasAttribute('onclick')).toBe(false);
    expect(value.querySelector('script')).toBeNull();
  });

  it('renders a checkbox for boolean columns and toggles via booleanToggle', () => {
    fixture.componentRef.setInput('col', { field: 'done', header: 'Done', type: 'boolean' });
    fixture.componentRef.setInput('value', true);
    fixture.componentRef.setInput('row', { done: true });
    const emitted: boolean[] = [];
    fixture.componentInstance.booleanToggle.subscribe(value => emitted.push(value));
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector('.ag-cell-checkbox') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(false);

    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(emitted).toEqual([false]);
  });

  it('disables the boolean checkbox and suppresses toggles when not editable', () => {
    fixture.componentRef.setInput('col', { field: 'done', header: 'Done', type: 'boolean' });
    fixture.componentRef.setInput('value', false);
    fixture.componentRef.setInput('editable', false);
    const emitted: boolean[] = [];
    fixture.componentInstance.booleanToggle.subscribe(value => emitted.push(value));
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector('.ag-cell-checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(emitted).toEqual([]);
  });

  it('emits the optional info action without activating the cell', () => {
    fixture.componentRef.setInput('col', { field: 'status', header: 'Status' });
    fixture.componentRef.setInput('showInfoIcon', true);
    let infoClicks = 0;
    let activations = 0;
    fixture.componentInstance.infoClick.subscribe(() => infoClicks++);
    fixture.componentInstance.activate.subscribe(() => activations++);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.ag-cell-info') as HTMLButtonElement;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(infoClicks).toBe(1);
    expect(activations).toBe(0);
  });

  it('shows the info action for boolean cells and hides it while editing', () => {
    fixture.componentRef.setInput('col', { field: 'done', header: 'Done', type: 'boolean' });
    fixture.componentRef.setInput('showInfoIcon', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ag-cell-info')).not.toBeNull();

    fixture.componentRef.setInput('editing', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ag-cell-info')).toBeNull();
  });

  it('formats the displayed value and tooltip once per input change', () => {
    let formatterCalls = 0;
    fixture.componentRef.setInput('col', {
      field: 'status',
      header: 'Status',
      formatter: (value: unknown) => {
        formatterCalls++;
        return `Formatted ${value}`;
      },
    });

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ag-cell-value').textContent)
      .toBe('Formatted Active');
    expect(fixture.nativeElement.title).toBe('Formatted Active');
    expect(formatterCalls).toBe(1);
  });

  it('applies conditional formatting from the current cell context', () => {
    const row = { status: 'Active' };
    let received: unknown;
    const column = {
      field: 'status',
      header: 'Status',
      textAlign: 'center' as const,
      cellFormat: (params: unknown) => {
        received = params;
        return {
          backgroundColor: 'rgb(254, 242, 242)',
          borderColor: 'rgb(220, 38, 38)',
          color: 'rgb(153, 27, 27)',
          fontFamily: 'serif',
          fontSize: '14px',
          fontStyle: 'italic',
          fontWeight: 700,
          textDecoration: 'underline',
          textAlign: 'right',
        };
      },
    };
    fixture.componentRef.setInput('col', column);
    fixture.componentRef.setInput('rowIndex', 3);
    fixture.componentRef.setInput('row', row);

    fixture.detectChanges();

    const cell = fixture.nativeElement as HTMLElement;
    expect(received).toEqual({ row, value: 'Active', column, originalIndex: 3 });
    expect(cell.style.backgroundColor).toBe('rgb(254, 242, 242)');
    expect(cell.style.borderColor).toBe('rgb(220, 38, 38)');
    expect(cell.style.color).toBe('rgb(153, 27, 27)');
    expect(cell.style.fontFamily).toBe('serif');
    expect(cell.style.fontSize).toBe('14px');
    expect(cell.style.fontStyle).toBe('italic');
    expect(cell.style.fontWeight).toBe('700');
    expect(cell.style.textDecoration).toBe('underline');
    expect(cell.style.textAlign).toBe('right');
  });

  it('uses the column text alignment when cell formatting does not override it', () => {
    fixture.componentRef.setInput('col', {
      field: 'status',
      header: 'Status',
      textAlign: 'center',
      cellFormat: () => ({ fontWeight: 600 }),
    });

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).style.textAlign).toBe('center');
  });

  it('updates text alignment when the column uses a signal', () => {
    const textAlign = signal<'left' | 'center' | 'right'>('left');
    fixture.componentRef.setInput('col', {
      field: 'status',
      header: 'Status',
      textAlign,
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).style.textAlign).toBe('left');

    textAlign.set('right');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).style.textAlign).toBe('right');
  });

  it('uses a native date input and preserves an ISO time suffix', async () => {
    fixture.componentRef.setInput('col', {
      field: 'hiredAt',
      header: 'Hired',
      type: 'date',
    });
    fixture.componentRef.setInput('value', '2024-03-15T14:30:00.000Z');
    fixture.componentRef.setInput('row', { hiredAt: '2024-03-15T14:30:00.000Z' });
    fixture.componentRef.setInput('editing', true);
    const emitted: unknown[] = [];
    fixture.componentInstance.draftChange.subscribe(value => emitted.push(value));
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-cell-input') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2024-03-15');

    input.value = '2025-04-20';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['2025-04-20T14:30:00.000Z']);
    expect(fixture.componentInstance.editorValue()).toBe('2025-04-20');
  });

  it('preserves a comma decimal draft in a number editor', async () => {
    fixture.componentRef.setInput('col', { field: 'amount', header: 'Amount', type: 'number' });
    fixture.componentRef.setInput('value', 12);
    fixture.componentRef.setInput('row', { amount: 12 });
    fixture.componentRef.setInput('editing', true);
    const emitted: unknown[] = [];
    fixture.componentInstance.draftChange.subscribe(value => emitted.push(value));
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-cell-input') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('decimal');

    input.value = '12,';
    input.dispatchEvent(new Event('input'));

    expect(input.value).toBe('12,');
    expect(fixture.componentInstance.editorValue()).toBe('12,');
    expect(emitted).toEqual(['12,']);
  });

  it('resolves and applies an input mask for the current row and cell', async () => {
    const row = { reference: '123456', numeric: true };
    let received: unknown;
    const column = {
      field: 'reference',
      header: 'Reference',
      inputMask: (params: unknown) => {
        received = params;
        return /\d{0,3}(?:-\d{0,5})?/;
      },
    };
    fixture.componentRef.setInput('col', column);
    fixture.componentRef.setInput('value', row.reference);
    fixture.componentRef.setInput('row', row);
    fixture.componentRef.setInput('editing', true);
    const emitted: unknown[] = [];
    fixture.componentInstance.draftChange.subscribe(value => emitted.push(value));
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-cell-input') as HTMLInputElement;
    expect(input.value).toBe('123456');
    expect(received).toEqual({ row, value: row.reference, column });

    input.value = '987-65432';
    input.dispatchEvent(new Event('input'));

    expect(input.value).toBe('987-65432');
    expect(emitted).toEqual(['987-65432']);

    input.value = '987-65x';
    input.dispatchEvent(new Event('input'));

    expect(input.value).toBe('987-65432');
    expect(emitted).toEqual(['987-65432']);
  });

  it('places the caret at the end of an unseeded text edit when text selection is disabled', async () => {
    fixture.componentRef.setInput('col', { field: 'status', header: 'Status', type: 'text' });
    fixture.componentRef.setInput('value', 'Active');
    fixture.componentRef.setInput('row', { status: 'Active' });
    fixture.componentRef.setInput('selectTextOnEdit', false);
    fixture.componentRef.setInput('editing', true);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-cell-input') as HTMLInputElement;

    expect(input.value).toBe('Active');
    expect(input.selectionStart).toBe(6);
    expect(input.selectionEnd).toBe(6);
  });
});
