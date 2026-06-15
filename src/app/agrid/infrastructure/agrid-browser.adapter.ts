/** Guarded access to browser-only APIs used by the grid. @internal */
export class AgridBrowserAdapter {
  /** Creates an adapter using injected browser globals or the current environment. */
  constructor(
    private readonly doc: Document | null =
      typeof document === 'undefined' ? null : document,
    private readonly win: Window | null =
      typeof window === 'undefined' ? null : window,
  ) {}

  /** Returns whether both document and window APIs are available. */
  get available(): boolean {
    return this.doc !== null && this.win !== null;
  }

  /** Registers a document event listener when a document is available. */
  addDocumentListener<K extends keyof DocumentEventMap>(
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
  ): void {
    this.doc?.addEventListener(type, listener as EventListener);
  }

  /** Removes a previously registered document event listener. */
  removeDocumentListener<K extends keyof DocumentEventMap>(
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
  ): void {
    this.doc?.removeEventListener(type, listener as EventListener);
  }

  /** Returns the element stack at viewport coordinates. */
  elementsFromPoint(x: number, y: number): Element[] {
    return this.doc?.elementsFromPoint?.(x, y) ?? [];
  }

  /** Appends an element to the document body when available. */
  appendToBody(element: HTMLElement): boolean {
    if (!this.doc?.body) return false;
    this.doc.body.appendChild(element);
    return true;
  }

  /** Sets cursor and text-selection styles on the document body. */
  setBodyInteraction(cursor: string, userSelect: string): void {
    if (!this.doc?.body) return;
    this.doc.body.style.cursor = cursor;
    this.doc.body.style.userSelect = userSelect;
  }

  /** Returns the viewport width or infinity during server rendering. */
  viewportWidth(): number {
    return this.win?.innerWidth ?? Number.POSITIVE_INFINITY;
  }

  /** Returns the viewport height or infinity during server rendering. */
  viewportHeight(): number {
    return this.win?.innerHeight ?? Number.POSITIVE_INFINITY;
  }

  /** Returns computed styles when a window is available. */
  computedStyle(element: Element): CSSStyleDeclaration | null {
    return this.win?.getComputedStyle?.(element) ?? null;
  }

  /** Creates a 2D canvas context for text measurement. */
  createCanvasContext(): CanvasRenderingContext2D | null {
    return this.doc?.createElement('canvas').getContext('2d') ?? null;
  }

  /** Schedules a callback with the environment timer. */
  schedule(callback: () => void, delay = 0): ReturnType<typeof setTimeout> {
    return setTimeout(callback, delay);
  }

  /** Writes text to the system clipboard, returning whether it succeeded. */
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

  /** Downloads text through a temporary object URL and anchor element. */
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
