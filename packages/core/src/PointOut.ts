import type { Annotation, PointOutConfig, ToolType } from './types';
import { Overlay, type NewAnnotationInput } from './overlay/Overlay';
import type { Transport } from './transport/Transport';
import { WebSocketTransport } from './transport/WebSocketTransport';
import { LocalTransport } from './transport/LocalTransport';
import { createId } from './utils/id';

type Listener = (...args: unknown[]) => void;

/**
 * PointOut – an overlay widget that lets clients annotate a live demo page
 * (pins, shapes, arrows, freehand drawing, text notes) and syncs those
 * annotations in real time to everyone else viewing the same page.
 */
export class PointOut {
  private readonly config: PointOutConfig & { mode: 'server' | 'local'; color: string; startVisible: boolean };
  private readonly transport: Transport;
  private readonly overlay: Overlay;
  private readonly page = location.pathname;
  private annotations = new Map<string, Annotation>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private visible: boolean;

  private constructor(config: PointOutConfig) {
    this.config = {
      color: '#ff4d4f',
      mode: config.server ? 'server' : 'local',
      startVisible: true,
      ...config,
    };
    this.visible = this.config.startVisible;

    this.transport =
      this.config.mode === 'server' && this.config.server
        ? new WebSocketTransport(this.config.server, this.config.project, this.config.token, this.config.user)
        : new LocalTransport(this.config.project);

    this.overlay = new Overlay({
      color: this.config.color,
      user: this.config.user,
      onCreate: (input) => this.handleCreate(input),
      onUpdate: (id, patch) => this.handleUpdate(id, patch),
      onRemove: (id) => this.handleRemove(id),
      onVisibilityToggle: (enabled) => this.handleVisibilityToggle(enabled),
    });

    this.transport.connect({
      onSnapshot: (list) => {
        const forThisPage = list.filter((a) => a.page === this.page);
        this.annotations = new Map(forThisPage.map((a) => [a.id, a]));
        this.overlay.renderAll(forThisPage);
      },
      onAdd: (a) => {
        if (a.page !== this.page) return;
        this.annotations.set(a.id, a);
        this.overlay.upsert(a);
        this.emit('annotation:add', a);
      },
      onUpdate: (id, patch) => {
        const a = this.annotations.get(id);
        if (!a) return;
        Object.assign(a, patch);
        this.overlay.upsert(a);
        this.emit('annotation:update', a);
      },
      onRemove: (id) => {
        this.annotations.delete(id);
        this.overlay.remove(id);
        this.emit('annotation:remove', id);
      },
      onVisibility: (enabled) => {
        this.visible = enabled;
        this.overlay.setVisible(enabled);
        this.emit('visibility', enabled);
      },
    });

    this.overlay.setVisible(this.visible);
  }

  /** Mounts the overlay on the current page. Call once, typically right after the page finishes loading. */
  static init(config: PointOutConfig): PointOut {
    if (typeof document === 'undefined') {
      throw new Error('PointOut can only run in a browser environment.');
    }
    return new PointOut(config);
  }

  private handleCreate(partial: NewAnnotationInput): Annotation {
    const annotation: Annotation = {
      id: createId(),
      page: this.page,
      author: this.config.user,
      resolved: false,
      createdAt: Date.now(),
      ...partial,
    };
    this.annotations.set(annotation.id, annotation);
    this.overlay.upsert(annotation);
    this.transport.add(annotation);
    this.emit('annotation:add', annotation);
    return annotation;
  }

  private handleUpdate(id: string, patch: Partial<Annotation>) {
    const a = this.annotations.get(id);
    if (!a) return;
    Object.assign(a, patch);
    this.overlay.upsert(a);
    this.transport.update(id, patch);
    this.emit('annotation:update', a);
  }

  private handleRemove(id: string) {
    this.annotations.delete(id);
    this.overlay.remove(id);
    this.transport.remove(id);
    this.emit('annotation:remove', id);
  }

  private handleVisibilityToggle(enabled: boolean) {
    this.visible = enabled;
    this.overlay.setVisible(enabled);
    this.transport.setVisibility(enabled);
    this.emit('visibility', enabled);
  }

  show() {
    this.handleVisibilityToggle(true);
  }

  hide() {
    this.handleVisibilityToggle(false);
  }

  toggle() {
    this.handleVisibilityToggle(!this.visible);
  }

  setTool(tool: ToolType) {
    this.overlay.setTool(tool);
  }

  /** Subscribe to lifecycle events: 'annotation:add' | 'annotation:update' | 'annotation:remove' | 'visibility'. */
  on(event: string, callback: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  destroy() {
    this.transport.disconnect();
    this.overlay.destroy();
  }
}
