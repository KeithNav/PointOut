import type { Annotation } from '../types';

export interface TransportEvents {
  onSnapshot: (annotations: Annotation[]) => void;
  onAdd: (annotation: Annotation) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onRemove: (id: string) => void;
  onVisibility: (enabled: boolean) => void;
}

/** Pluggable sync layer. The SDK ships a WebSocket transport (talks to the self-hosted relay server) and a LocalStorage transport (for zero-backend testing). */
export interface Transport {
  connect(events: TransportEvents): Promise<void>;
  add(annotation: Annotation): void;
  update(id: string, patch: Partial<Annotation>): void;
  remove(id: string): void;
  setVisibility(enabled: boolean): void;
  disconnect(): void;
}
