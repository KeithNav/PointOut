import type { Annotation, PointOutUser, ToolType } from '../types';
import { STYLES } from '../styles';
import { docSize, escapeHtml, toPercent, toPixels } from '../utils/geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  { id: 'pointer', label: 'Select', icon: '➤' },
  { id: 'pin', label: 'Pin a comment', icon: '📍' },
  { id: 'rect', label: 'Circle/box an area', icon: '▭' },
  { id: 'arrow', label: 'Arrow', icon: '↗' },
  { id: 'pen', label: 'Draw', icon: '✏️' },
  { id: 'text', label: 'Text label', icon: 'T' },
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

  private tool: ToolType = 'pointer';
  private color: string;
  private visible = true;
  private readonly shapeEls = new Map<string, SVGGElement>();
  private data = new Map<string, Annotation>();
  private resizeObserver?: ResizeObserver;

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
      btn.textContent = t.icon;
      btn.addEventListener('click', () => this.setTool(t.id));
      this.toolbar.appendChild(btn);
    });

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

    const bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'po-bubble';
    bubble.title = 'Toggle PointOut feedback';
    bubble.textContent = 'PO';
    bubble.addEventListener('click', () => this.opts.onVisibilityToggle(!this.visible));
    this.root.appendChild(bubble);

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
  }

  remove(id: string) {
    this.data.delete(id);
    this.shapeEls.get(id)?.remove();
    this.shapeEls.delete(id);
    this.popoverLayer.querySelector(`[data-popover-for="${id}"]`)?.remove();
  }

  renderAll(list: Annotation[]) {
    this.shapeEls.forEach((el) => el.remove());
    this.shapeEls.clear();
    this.data = new Map(list.map((a) => [a.id, a]));
    list.forEach((a) => this.renderOne(a));
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
    textarea.focus();
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
