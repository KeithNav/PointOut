export type Role = 'client' | 'developer';

export type ToolType = 'pointer' | 'pin' | 'rect' | 'arrow' | 'pen' | 'text';

export type AnnotationType = Exclude<ToolType, 'pointer'>;

export interface Point {
  x: number;
  y: number;
}

export interface PointOutUser {
  name: string;
  role: Role;
}

/** A single mark left on the page. Coordinates are percentages (0-100) of the full document size, so they stay roughly in place across viewport sizes. */
export interface Annotation {
  id: string;
  type: AnnotationType;
  page: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: Point[];
  color: string;
  message?: string;
  author: PointOutUser;
  resolved: boolean;
  createdAt: number;
}

export interface PointOutConfig {
  /** Identifies which demo/client project the annotations belong to. */
  project: string;
  user: PointOutUser;
  /** URL of a self-hosted PointOut relay server (http(s):// or ws(s)://). Omit to fall back to local-only mode. */
  server?: string;
  /** Shared secret configured on the relay server (POINTOUT_API_KEY). */
  token?: string;
  /** 'server' requires `server`; 'local' keeps everything in localStorage for quick testing without a backend. */
  mode?: 'server' | 'local';
  startVisible?: boolean;
  color?: string;
}

export type ServerMessage =
  | { type: 'snapshot'; annotations: Annotation[] }
  | { type: 'add'; annotation: Annotation }
  | { type: 'update'; id: string; patch: Partial<Annotation> }
  | { type: 'remove'; id: string }
  | { type: 'visibility'; enabled: boolean };
