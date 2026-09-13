import type { Annotation, PointOutUser, ToolType } from '../types';
import { STYLES } from '../styles';
import { docSize, escapeHtml, toPercent, toPixels } from '../utils/geometry';
import wordmarkUrl from '../assets/pointout-wordmark.png?inline';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BRAND_MARK = `
  <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="po-brand-gradient" x1="8" y1="7" x2="40" y2="42" gradientUnits="userSpaceOnUse">
        <stop stop-color="#5bb7ff"/>
        <stop offset="1" stop-color="#1463ef"/>
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="16" stroke="url(#po-brand-gradient)" stroke-width="6"/>
    <circle cx="24" cy="24" r="2.5" fill="#55aaff"/>
  </svg>
`;

type Pt = { x: number; y: number };

export type NewAnnotationInput = Pick<Annotation, 'type' | 'x' | 'y' | 'width' | 'height' | 'points' | 'color' | 'message'>;

export interface OverlayOptions {
  color: string;
  user: PointOutUser;
  onCreate: (input: NewAnnotationInput) => Annotation;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onRemove: (id: string) => void;
  onVisibilityToggle: (enabled: boolean) => void;
}

const TOOLS: { id: ToolType; label: string; icon: string }[] = [
  { id: 'pointer', label: 'Select', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 3 14 8-6.3 1.7L11 19 5 3Z"/><path d="m13 13 4 5"/></svg>' },
  { id: 'pin', label: 'Pin a comment', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.25"/></svg>' },
  { id: 'rect', label: 'Circle or box an area', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 5v3M16 16v3M20 9h-3M7 15H4"/></svg>' },
  { id: 'arrow', label: 'Draw an arrow', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5"/><path d="M10 5h9v9"/></svg>' },
  { id: 'pen', label: 'Draw freehand', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5 4 4M4 20l3.8-1 10.7-10.7a2.8 2.8 0 0 0-4-4L3.8 15 4 20Z"/></svg>' },
  { id: 'text', label: 'Add a text label', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14M12 5v14M8 19h8"/></svg>' },
];

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Renders the PointOut UI (toolbar, toggle bubble, drawing canvas and comment popovers) inside a Shadow DOM root, isolated from the host page's styles. */
export class Overlay {
  private readonly host: HTMLDivElement;
  private readonly shadow: ShadowRoot;
  private root!: HTMLDivElement;
  private svg!: SVGSVGElement;
  private toolbar!: HTMLDivElement;
  private popoverLayer!: HTMLDivElement;
  private bubble!: HTMLButtonElement;
  private issuePanel!: HTMLElement;
  private issueList!: HTMLDivElement;
  private issueCount!: HTMLSpanElement;
  private issueListButton!: HTMLButtonElement;

  private tool: ToolType = 'pointer';
  private color: string;
  private visible = true;
  private readonly shapeEls = new Map<string, SVGGElement>();
  private data = new Map<string, Annotation>();
  private resizeObserver?: ResizeObserver;
  private selectedAnnotationId?: string;

  constructor(private readonly opts: OverlayOptions) {
    this.color = opts.color;
    this.host = document.createElement('div');
    this.host.setAttribute('data-pointout-host', '');
    this.host.style.cssText = 'all:initial; position:absolute; top:0; left:0; width:0; height:0; z-index:2147483647;';
    document.documentElement.appendChild(this.host);
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.build();
    this.observeResize();
  }

  private build() {
    const style = document.createElement('style');
    style.textContent = STYLES;
    this.shadow.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'po-root';
    this.shadow.appendChild(this.root);

    this.svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    this.svg.setAttribute('class', 'po-canvas');
    this.svg.appendChild(document.createElementNS(SVG_NS, 'defs'));
    this.root.appendChild(this.svg);

    this.popoverLayer = document.createElement('div');
    this.popoverLayer.className = 'po-popover-layer';
    this.root.appendChild(this.popoverLayer);

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'po-toolbar';
    TOOLS.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'po-tool-btn';
      btn.dataset.tool = t.id;
      btn.title = t.label;
      btn.setAttribute('aria-label', t.label);
      btn.innerHTML = t.icon;
      btn.addEventListener('click', () => this.setTool(t.id));
      this.toolbar.appendChild(btn);
    });

    this.issueListButton = document.createElement('button');
    this.issueListButton.type = 'button';
    this.issueListButton.className = 'po-tool-btn po-list-btn';
    this.issueListButton.title = 'Open feedback list';
    this.issueListButton.setAttribute('aria-label', 'Open feedback list');
    this.issueListButton.setAttribute('aria-expanded', 'false');
    this.issueListButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h11M8 12h11M8 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>';
    this.issueListButton.addEventListener('click', () => this.toggleIssuePanel());
    this.toolbar.appendChild(this.issueListButton);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'po-color';
    colorInput.value = this.color;
    colorInput.title = 'Annotation color';
    colorInput.addEventListener('input', () => {
      this.color = colorInput.value;
    });
    this.toolbar.appendChild(colorInput);

    const hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'po-hide-btn';
    hideBtn.textContent = 'Hide';
    hideBtn.title = 'Hide the PointOut overlay';
    hideBtn.addEventListener('click', () => this.opts.onVisibilityToggle(false));
    this.toolbar.appendChild(hideBtn);

    this.root.appendChild(this.toolbar);

    this.issuePanel = document.createElement('aside');
    this.issuePanel.className = 'po-issue-panel';
    this.issuePanel.setAttribute('aria-label', 'Feedback list');
    this.issuePanel.innerHTML = `
      <div class="po-issue-panel-head">
        <span class="po-issue-panel-logo" aria-hidden="true">${BRAND_MARK}</span>
        <div>
          <h2>Feedback</h2>
        </div>
        <div class="po-issue-panel-actions">
          <span class="po-issue-count">0</span>
          <button type="button" class="po-issue-panel-close" aria-label="Close feedback list">✕</button>
        </div>
      </div>
      <div class="po-issue-list"></div>
    `;
    this.issueCount = this.issuePanel.querySelector('.po-issue-count')!;
    this.issueList = this.issuePanel.querySelector('.po-issue-list')!;
    this.issuePanel.querySelector<HTMLButtonElement>('.po-issue-panel-close')!
      .addEventListener('click', () => this.setIssuePanelOpen(false));
    this.root.appendChild(this.issuePanel);

    this.bubble = document.createElement('button');
    this.bubble.type = 'button';
    this.bubble.className = 'po-bubble';
    this.bubble.innerHTML = `
      <span class="po-bubble-mark" aria-hidden="true">
        ${BRAND_MARK}
      </span>
      <span class="po-bubble-copy">
        <img class="po-bubble-wordmark" src="${wordmarkUrl}" alt="PointOut" />
        <span class="po-bubble-status">Feedback</span>
      </span>
      <span class="po-bubble-indicator" aria-hidden="true"></span>
    `;
    this.bubble.addEventListener('click', () => this.opts.onVisibilityToggle(!this.visible));
    this.root.appendChild(this.bubble);

    this.updateToolButtons();
    this.attachCanvasEvents();
  }

  // ---- Tool state ---------------------------------------------------

  setTool(tool: ToolType) {
    this.tool = tool;
    this.svg.style.pointerEvents = tool === 'pointer' ? 'none' : 'auto';
    this.svg.style.cursor = tool === 'pointer' ? 'default' : 'crosshair';
    this.updateToolButtons();
  }

  private updateToolButtons() {
    this.toolbar.querySelectorAll<HTMLButtonElement>('.po-tool-btn').forEach((btn) => {
      btn.dataset.active = String(btn.dataset.tool === this.tool);
    });
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.root.setAttribute('data-visible', String(visible));
    this.bubble.setAttribute('aria-expanded', String(visible));
    this.bubble.title = visible ? 'Hide PointOut feedback tools' : 'Show PointOut feedback tools';
    const status = this.bubble.querySelector('.po-bubble-status');
    if (status) status.textContent = visible ? 'Feedback active' : 'Open feedback';
  }

  private toggleIssuePanel() {
    this.setIssuePanelOpen(this.issuePanel.dataset.open !== 'true');
  }

  private setIssuePanelOpen(open: boolean) {
    this.issuePanel.dataset.open = String(open);
    this.issueListButton.setAttribute('aria-expanded', String(open));
    this.issueListButton.dataset.active = String(open);
    if (open) this.renderIssueList();
  }

  private renderIssueList() {
    const annotations = [...this.data.values()].sort((a, b) => b.createdAt - a.createdAt);
    const unresolvedCount = annotations.filter((annotation) => !annotation.resolved).length;
    this.issueCount.textContent = String(unresolvedCount);
    this.issueCount.title = `${unresolvedCount} open feedback item${unresolvedCount === 1 ? '' : 's'}`;
    this.issueList.replaceChildren();

    if (!annotations.length) {
      const empty = document.createElement('p');
      empty.className = 'po-issue-empty';
      empty.textContent = 'No feedback yet. Use a tool to add your first note.';
      this.issueList.appendChild(empty);
      return;
    }

    annotations.forEach((annotation) => {
      const item = document.createElement('article');
      item.className = 'po-issue-item';
      item.dataset.selected = String(annotation.id === this.selectedAnnotationId);

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'po-issue-select';
      select.innerHTML = `
        <span class="po-issue-meta">
          <span class="po-issue-type">${this.issueTypeLabel(annotation.type)}</span>
          <span class="po-issue-status" data-resolved="${annotation.resolved}">${annotation.resolved ? 'Resolved' : 'Open'}</span>
        </span>
        <strong>${escapeHtml(annotation.author.name)}</strong>
        <span class="po-issue-message">${escapeHtml(annotation.message || 'No message yet')}</span>
        <span class="po-issue-footer">${annotation.comments?.length ?? 0} comment${(annotation.comments?.length ?? 0) === 1 ? '' : 's'} · ${new Date(annotation.createdAt).toLocaleTimeString()}</span>
      `;
      select.addEventListener('click', () => {
        this.selectedAnnotationId = annotation.id;
        this.renderIssueList();
        this.openPopover(annotation, false);
      });
      item.appendChild(select);

      if (this.opts.user.role === 'developer' && annotation.type !== 'text') {
        const resolve = document.createElement('button');
        resolve.type = 'button';
        resolve.className = 'po-issue-resolve';
        resolve.textContent = annotation.resolved ? 'Reopen' : 'Resolve';
        resolve.addEventListener('click', () => this.opts.onUpdate(annotation.id, { resolved: !annotation.resolved }));
        item.appendChild(resolve);
      }

      this.issueList.appendChild(item);
    });
  }

  private issueTypeLabel(type: Annotation['type']) {
    const labels: Record<Annotation['type'], string> = {
      pin: 'Comment pin',
      rect: 'Area highlight',
      arrow: 'Arrow',
      pen: 'Drawing',
      text: 'Text note',
    };
    return labels[type];
  }

  // ---- Drawing gestures ----------------------------------------------

  private attachCanvasEvents() {
    let start: Pt | null = null;
    let preview: SVGElement | null = null;
    let penPoints: Pt[] = [];
    const docPoint = (e: PointerEvent): Pt => ({ x: e.pageX, y: e.pageY });

    this.svg.addEventListener('pointerdown', (e) => {
      if (this.tool === 'pointer') return;
      e.preventDefault();
      const p = docPoint(e);

      if (this.tool === 'pin' || this.tool === 'text') {
        this.finishShape(this.tool, { x: p.x, y: p.y });
        return;
      }

      start = p;
      if (this.tool === 'pen') {
        penPoints = [p];
        preview = this.createPreviewPen();
      } else if (this.tool === 'rect') {
        preview = this.createPreviewRect(p, p);
      } else if (this.tool === 'arrow') {
        preview = this.createPreviewLine(p, p);
      }
    });

    this.svg.addEventListener('pointermove', (e) => {
      if (!start || !preview) return;
      const p = docPoint(e);
      if (this.tool === 'pen') {
        penPoints.push(p);
        this.updatePreviewPen(preview as SVGPolylineElement, penPoints);
      } else if (this.tool === 'rect') {
        this.updatePreviewRect(preview as SVGRectElement, start, p);
      } else if (this.tool === 'arrow') {
        this.updatePreviewLine(preview as SVGLineElement, start, p);
      }
    });

    const finish = (e: PointerEvent) => {
      if (!start) return;
      const p = docPoint(e);
      preview?.remove();
      preview = null;

      if (this.tool === 'rect') {
        const x = Math.min(start.x, p.x);
        const y = Math.min(start.y, p.y);
        const width = Math.abs(p.x - start.x);
        const height = Math.abs(p.y - start.y);
        if (width > 4 && height > 4) this.finishShape('rect', { x, y, width, height });
      } else if (this.tool === 'arrow') {
        if (Math.hypot(p.x - start.x, p.y - start.y) > 4) this.finishShape('arrow', { points: [start, p] });
      } else if (this.tool === 'pen') {
        if (penPoints.length > 1) this.finishShape('pen', { points: penPoints });
      }
      start = null;
      penPoints = [];
    };

    this.svg.addEventListener('pointerup', finish);
    this.svg.addEventListener('pointercancel', finish);
  }

  private finishShape(type: Exclude<ToolType, 'pointer'>, geom: { x?: number; y?: number; width?: number; height?: number; points?: Pt[] }) {
    const { width: dw, height: dh } = docSize();
    const input: NewAnnotationInput = {
      type,
      color: this.color,
      x: geom.x !== undefined ? toPercent(geom.x, dw) : undefined,
      y: geom.y !== undefined ? toPercent(geom.y, dh) : undefined,
      width: geom.width !== undefined ? toPercent(geom.width, dw) : undefined,
      height: geom.height !== undefined ? toPercent(geom.height, dh) : undefined,
      points: geom.points?.map((pt) => ({ x: toPercent(pt.x, dw), y: toPercent(pt.y, dh) })),
      message: undefined,
    };
    const annotation = this.opts.onCreate(input);
    this.openPopover(annotation, true);
  }

  private createPreviewRect(a: Pt, b: Pt): SVGRectElement {
    const rect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
    rect.setAttribute('fill', withAlpha(this.color, 0.15));
    rect.setAttribute('stroke', this.color);
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '4 3');
    this.svg.appendChild(rect);
    this.updatePreviewRect(rect, a, b);
    return rect;
  }

  private updatePreviewRect(rect: SVGRectElement, a: Pt, b: Pt) {
    rect.setAttribute('x', String(Math.min(a.x, b.x)));
    rect.setAttribute('y', String(Math.min(a.y, b.y)));
    rect.setAttribute('width', String(Math.abs(b.x - a.x)));
    rect.setAttribute('height', String(Math.abs(b.y - a.y)));
  }

  private createPreviewLine(a: Pt, b: Pt): SVGLineElement {
    const line = document.createElementNS(SVG_NS, 'line') as SVGLineElement;
    line.setAttribute('stroke', this.color);
    line.setAttribute('stroke-width', '3');
    line.setAttribute('stroke-dasharray', '4 3');
    this.svg.appendChild(line);
    this.updatePreviewLine(line, a, b);
    return line;
  }

  private updatePreviewLine(line: SVGLineElement, a: Pt, b: Pt) {
    line.setAttribute('x1', String(a.x));
    line.setAttribute('y1', String(a.y));
    line.setAttribute('x2', String(b.x));
    line.setAttribute('y2', String(b.y));
  }

  private createPreviewPen(): SVGPolylineElement {
    const poly = document.createElementNS(SVG_NS, 'polyline') as SVGPolylineElement;
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', this.color);
    poly.setAttribute('stroke-width', '3');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    this.svg.appendChild(poly);
    return poly;
  }

  private updatePreviewPen(poly: SVGPolylineElement, points: Pt[]) {
    poly.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
  }

  // ---- Rendering permanent annotations --------------------------------

  upsert(annotation: Annotation) {
    this.data.set(annotation.id, annotation);
    this.renderOne(annotation);
    this.renderIssueList();
  }

  remove(id: string) {
    this.data.delete(id);
    this.shapeEls.get(id)?.remove();
    this.shapeEls.delete(id);
    this.popoverLayer.querySelector(`[data-popover-for="${id}"]`)?.remove();
    if (this.selectedAnnotationId === id) this.selectedAnnotationId = undefined;
    this.renderIssueList();
  }

  renderAll(list: Annotation[]) {
    this.shapeEls.forEach((el) => el.remove());
    this.shapeEls.clear();
    this.data = new Map(list.map((a) => [a.id, a]));
    list.forEach((a) => this.renderOne(a));
    this.renderIssueList();
  }

  private renderOne(annotation: Annotation) {
    this.shapeEls.get(annotation.id)?.remove();
    const { width: dw, height: dh } = docSize();
    const g = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    g.setAttribute('class', 'po-shape');
    g.setAttribute('data-id', annotation.id);
    g.setAttribute('data-resolved', String(annotation.resolved));
    g.style.pointerEvents = 'auto';
    g.style.cursor = 'pointer';

    const px = toPixels(annotation.x ?? 0, dw);
    const py = toPixels(annotation.y ?? 0, dh);

    switch (annotation.type) {
      case 'pin': {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(px));
        circle.setAttribute('cy', String(py));
        circle.setAttribute('r', '11');
        circle.setAttribute('fill', annotation.color);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        g.appendChild(circle);
        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', String(px));
        label.setAttribute('y', String(py + 4));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '11');
        label.setAttribute('fill', '#fff');
        label.textContent = '!';
        g.appendChild(label);
        break;
      }
      case 'rect': {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(px));
        rect.setAttribute('y', String(py));
        rect.setAttribute('width', String(toPixels(annotation.width ?? 0, dw)));
        rect.setAttribute('height', String(toPixels(annotation.height ?? 0, dh)));
        rect.setAttribute('rx', '6');
        rect.setAttribute('fill', withAlpha(annotation.color, 0.12));
        rect.setAttribute('stroke', annotation.color);
        rect.setAttribute('stroke-width', '2.5');
        g.appendChild(rect);
        break;
      }
      case 'arrow': {
        const pts = (annotation.points ?? []).map((p) => ({ x: toPixels(p.x, dw), y: toPixels(p.y, dh) }));
        const markerId = `po-arrow-${annotation.id}`;
        const marker = document.createElementNS(SVG_NS, 'marker');
        marker.setAttribute('id', markerId);
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('orient', 'auto');
        const arrowHead = document.createElementNS(SVG_NS, 'path');
        arrowHead.setAttribute('d', 'M0,0 L10,5 L0,10 Z');
        arrowHead.setAttribute('fill', annotation.color);
        marker.appendChild(arrowHead);
        this.svg.querySelector('defs')!.appendChild(marker);

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(pts[0]?.x ?? px));
        line.setAttribute('y1', String(pts[0]?.y ?? py));
        line.setAttribute('x2', String(pts[1]?.x ?? px));
        line.setAttribute('y2', String(pts[1]?.y ?? py));
        line.setAttribute('stroke', annotation.color);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('marker-end', `url(#${markerId})`);
        g.appendChild(line);
        break;
      }
      case 'pen': {
        const points = (annotation.points ?? []).map((p) => `${toPixels(p.x, dw)},${toPixels(p.y, dh)}`).join(' ');
        const poly = document.createElementNS(SVG_NS, 'polyline');
        poly.setAttribute('points', points);
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', annotation.color);
        poly.setAttribute('stroke-width', '3');
        poly.setAttribute('stroke-linecap', 'round');
        poly.setAttribute('stroke-linejoin', 'round');
        poly.setAttribute('pointer-events', 'stroke');
        g.appendChild(poly);
        break;
      }
      case 'text': {
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(px));
        text.setAttribute('y', String(py));
        text.setAttribute('font-size', '15');
        text.setAttribute('font-weight', '600');
        text.setAttribute('fill', annotation.color);
        text.setAttribute('paint-order', 'stroke');
        text.setAttribute('stroke', '#fff');
        text.setAttribute('stroke-width', '3');
        text.textContent = annotation.message || '…';
        g.appendChild(text);
        break;
      }
    }

    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPopover(annotation, false);
    });

    this.svg.appendChild(g);
    this.shapeEls.set(annotation.id, g);
  }

  // ---- Comment popover -------------------------------------------------

  private openPopover(annotation: Annotation, isNew: boolean) {
    this.popoverLayer.querySelectorAll('.po-popover').forEach((el) => el.remove());
    const { width: dw, height: dh } = docSize();
    const anchor = annotation.points?.[0] ?? { x: annotation.x ?? 0, y: annotation.y ?? 0 };
    const px = toPixels(anchor.x, dw);
    const py = toPixels(anchor.y, dh);

    const canEdit = this.opts.user.role === 'developer' || annotation.author.name === this.opts.user.name;
    const canResolve = this.opts.user.role === 'developer';
    const isTextType = annotation.type === 'text';

    const box = document.createElement('div');
    box.className = 'po-popover';
    box.setAttribute('data-popover-for', annotation.id);
    box.style.left = `${px}px`;
    box.style.top = `${py}px`;

    const head = document.createElement('div');
    head.className = 'po-popover-head';
    head.innerHTML = `<span>${escapeHtml(annotation.author.name)} · ${annotation.author.role}</span><span>${new Date(annotation.createdAt).toLocaleTimeString()}</span>`;
    box.appendChild(head);

    const textarea = document.createElement('textarea');
    textarea.placeholder = isTextType ? 'Type the label text…' : 'Write a note for the developer…';
    textarea.value = annotation.message ?? '';
    textarea.disabled = !canEdit;
    box.appendChild(textarea);
    let focusTarget: HTMLTextAreaElement = textarea;

    if (annotation.comments?.length) {
      const comments = document.createElement('div');
      comments.className = 'po-comments';
      annotation.comments.forEach((comment) => {
        const item = document.createElement('div');
        item.className = 'po-comment';
        item.innerHTML = `<strong>${escapeHtml(comment.author.name)}</strong><span>${escapeHtml(comment.message)}</span>`;
        comments.appendChild(item);
      });
      box.appendChild(comments);
    }

    const actions = document.createElement('div');
    actions.className = 'po-popover-actions';

    if (!isTextType) {
      const resolveLabel = document.createElement('label');
      resolveLabel.className = 'po-resolve';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = annotation.resolved;
      checkbox.disabled = !canResolve;
      checkbox.addEventListener('change', () => this.opts.onUpdate(annotation.id, { resolved: checkbox.checked }));
      resolveLabel.appendChild(checkbox);
      resolveLabel.append('Resolved');
      actions.appendChild(resolveLabel);
    }

    if (canEdit) {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'po-save';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => {
        this.opts.onUpdate(annotation.id, { message: textarea.value });
        box.remove();
      });
      actions.appendChild(saveBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'po-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        this.opts.onRemove(annotation.id);
        box.remove();
      });
      actions.appendChild(deleteBtn);
    } else {
      const reply = document.createElement('textarea');
      reply.className = 'po-reply';
      reply.placeholder = 'Add a comment…';
      reply.setAttribute('aria-label', 'Add a comment');
      box.appendChild(reply);
      focusTarget = reply;

      const replyBtn = document.createElement('button');
      replyBtn.className = 'po-save';
      replyBtn.textContent = 'Comment';
      replyBtn.addEventListener('click', () => {
        const message = reply.value.trim();
        if (!message) {
          reply.focus();
          return;
        }
        this.opts.onUpdate(annotation.id, {
          comments: [
            ...(annotation.comments ?? []),
            { author: this.opts.user, message, createdAt: Date.now() },
          ],
        });
        box.remove();
      });
      actions.appendChild(replyBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'po-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
      if (isNew && isTextType && !textarea.value.trim()) this.opts.onRemove(annotation.id);
      box.remove();
    });
    actions.appendChild(closeBtn);

    box.appendChild(actions);
    this.popoverLayer.appendChild(box);
    focusTarget.focus();
  }

  // ---- Sizing & lifecycle ----------------------------------------------

  private observeResize() {
    const update = () => this.updateCanvasSize();
    window.addEventListener('resize', update);
    this.resizeObserver = new ResizeObserver(update);
    this.resizeObserver.observe(document.documentElement);
    update();
  }

  private updateCanvasSize() {
    const { width, height } = docSize();
    this.svg.setAttribute('width', String(width));
    this.svg.setAttribute('height', String(height));
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.popoverLayer.style.width = `${width}px`;
    this.popoverLayer.style.height = `${height}px`;
    this.data.forEach((a) => this.renderOne(a));
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.host.remove();
  }
}
