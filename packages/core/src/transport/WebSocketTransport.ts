import type { Annotation, PointOutUser, ServerMessage } from '../types';
import type { Transport, TransportEvents } from './Transport';

/** Real-time sync against a self-hosted PointOut relay server (see packages/server). Reconnects automatically with backoff and queues messages sent while offline. */
export class WebSocketTransport implements Transport {
  private ws?: WebSocket;
  private events?: TransportEvents;
  private reconnectDelay = 1000;
  private closedByUser = false;
  private readonly queue: string[] = [];

  constructor(
    private readonly serverUrl: string,
    private readonly project: string,
    private readonly token: string | undefined,
    private readonly user: PointOutUser,
  ) {}

  connect(events: TransportEvents): Promise<void> {
    this.events = events;
    return new Promise((resolve) => this.open(resolve));
  }

  private open(onOpen?: () => void) {
    const url = new URL(this.serverUrl.replace(/^http/, 'ws'));
    url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
    url.searchParams.set('project', this.project);
    if (this.token) url.searchParams.set('token', this.token);
    url.searchParams.set('role', this.user.role);
    url.searchParams.set('name', this.user.name);

    const ws = new WebSocket(url.toString());
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.reconnectDelay = 1000;
      this.queue.splice(0).forEach((msg) => ws.send(msg));
      onOpen?.();
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      switch (msg.type) {
        case 'snapshot':
          this.events?.onSnapshot(msg.annotations);
          break;
        case 'add':
          this.events?.onAdd(msg.annotation);
          break;
        case 'update':
          this.events?.onUpdate(msg.id, msg.patch);
          break;
        case 'remove':
          this.events?.onRemove(msg.id);
          break;
        case 'visibility':
          this.events?.onVisibility(msg.enabled);
          break;
      }
    });

    ws.addEventListener('close', () => {
      if (this.closedByUser) return;
      setTimeout(() => this.open(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000);
    });
  }

  private send(payload: Record<string, unknown>) {
    const data = JSON.stringify(payload);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
    else this.queue.push(data);
  }

  add(annotation: Annotation) {
    this.send({ type: 'add', annotation });
  }

  update(id: string, patch: Partial<Annotation>) {
    this.send({ type: 'update', id, patch });
  }

  remove(id: string) {
    this.send({ type: 'remove', id });
  }

  setVisibility(enabled: boolean) {
    this.send({ type: 'visibility', enabled });
  }

  disconnect() {
    this.closedByUser = true;
    this.ws?.close();
  }
}
