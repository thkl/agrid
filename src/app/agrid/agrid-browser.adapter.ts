/** Guarded access to browser-only APIs used by the grid. */
export class AgridBrowserAdapter {
  constructor(
    private readonly doc: Document | null =
      typeof document === 'undefined' ? null : document,
    private readonly win: Window | null =
      typeof window === 'undefined' ? null : window,
  ) {}

  get available(): boolean {
    return this.doc !== null && this.win !== null;
  }

  addDocumentListener<K extends keyof DocumentEventMap>(
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
  ): void {
    this.doc?.addEventListener(type, listener as EventListener);
  }

  removeDocumentListener<K extends keyof DocumentEventMap>(
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
  ): void {
    this.doc?.removeEventListener(type, listener as EventListener);
  }

  elementsFromPoint(x: number, y: number): Element[] {
    return this.doc?.elementsFromPoint?.(x, y) ?? [];
  }

  appendToBody(element: HTMLElement): boolean {
    if (!this.doc?.body) return false;
    this.doc.body.appendChild(element);
    return true;
  }

  setBodyInteraction(cursor: string, userSelect: string): void {
    if (!this.doc?.body) return;
    this.doc.body.style.cursor = cursor;
    this.doc.body.style.userSelect = userSelect;
  }

  viewportWidth(): number {
    return this.win?.innerWidth ?? Number.POSITIVE_INFINITY;
  }

  computedStyle(element: Element): CSSStyleDeclaration | null {
    return this.win?.getComputedStyle?.(element) ?? null;
  }

  createCanvasContext(): CanvasRenderingContext2D | null {
    return this.doc?.createElement('canvas').getContext('2d') ?? null;
  }

  schedule(callback: () => void, delay = 0): ReturnType<typeof setTimeout> {
    return setTimeout(callback, delay);
  }

  async writeClipboard(text: string): Promise<boolean> {
    try {
      const clipboard = this.win?.navigator.clipboard;
      if (!clipboard?.writeText) return false;
      await clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  downloadText(filename: string, text: string, mimeType: string): boolean {
    const urlApi = (this.win as unknown as { URL?: typeof URL } | null)?.URL
      ?? (typeof URL === 'undefined' ? null : URL);
    if (!this.doc?.body || !urlApi?.createObjectURL) return false;
    let url: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    try {
      url = urlApi.createObjectURL(new Blob([text], { type: mimeType }));
      anchor = this.doc.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      this.doc.body.appendChild(anchor);
      anchor.click();
      return true;
    } catch {
      return false;
    } finally {
      anchor?.remove();
      if (url) urlApi.revokeObjectURL(url);
    }
  }
}
