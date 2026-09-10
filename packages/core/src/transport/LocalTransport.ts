import type { Annotation } from '../types';
import type { Transport, TransportEvents } from './Transport';

/** Zero-backend fallback: stores annotations in localStorage and syncs across tabs/windows via the `storage` event. Useful for trying PointOut out before deploying a relay server. */
export class LocalTransport implements Transport {
  private readonly key: string;
  private events?: TransportEvents;

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== this.key) return;
    this.events?.onSnapshot(this.readAll());
  };

  constructor(project: string) {
    this.key = `pointout:${project}`;
  }

  async connect(events: TransportEvents): Promise<void> {
    this.events = events;
    window.addEventListener('storage', this.onStorage);
    events.onSnapshot(this.readAll());
    events.onVisibility(localStorage.getItem(`${this.key}:visible`) !== 'false');
  }

  private readAll(): Annotation[] {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? '[]');
    } catch {
      return [];
    }
  }

  private writeAll(list: Annotation[]) {
    localStorage.setItem(this.key, JSON.stringify(list));
    // Same-tab writes don't fire `storage`, so notify this tab directly too.
    this.events?.onSnapshot(list);
  }

  add(annotation: Annotation) {
    this.writeAll([...this.readAll(), annotation]);
  }

  update(id: string, patch: Partial<Annotation>) {
    const list = this.readAll();
    const index = list.findIndex((a) => a.id === id);
    if (index === -1) return;
    list[index] = { ...list[index], ...patch };
    this.writeAll(list);
  }

  remove(id: string) {
    this.writeAll(this.readAll().filter((a) => a.id !== id));
  }

  setVisibility(enabled: boolean) {
    localStorage.setItem(`${this.key}:visible`, String(enabled));
  }

  disconnect() {
    window.removeEventListener('storage', this.onStorage);
  }
}
