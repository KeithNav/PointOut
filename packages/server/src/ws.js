import { WebSocketServer } from 'ws';
import { listAnnotations, upsertAnnotation, patchAnnotation, removeAnnotation, getVisibility, setVisibility } from './db.js';

// project -> Set of connected sockets, i.e. everyone (developer + clients) watching that demo.
const rooms = new Map();

function broadcast(project, message, exclude) {
  const clients = rooms.get(project);
  if (!clients) return;
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client !== exclude && client.readyState === client.OPEN) client.send(payload);
  }
}

export function attachWebSocketServer(server, { apiKey }) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const project = url.searchParams.get('project');
    const token = url.searchParams.get('token');
    const role = url.searchParams.get('role') === 'developer' ? 'developer' : 'client';
    const name = url.searchParams.get('name') || 'Guest';

    if (!project) {
      ws.close(4000, 'Missing project');
      return;
    }
    if (apiKey && token !== apiKey) {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.project = project;
    ws.role = role;
    ws.userName = name;

    if (!rooms.has(project)) rooms.set(project, new Set());
    rooms.get(project).add(ws);

    ws.send(JSON.stringify({ type: 'snapshot', annotations: listAnnotations(project) }));
    ws.send(JSON.stringify({ type: 'visibility', enabled: getVisibility(project) }));

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'add' && msg.annotation) {
        upsertAnnotation(project, msg.annotation);
        broadcast(project, { type: 'add', annotation: msg.annotation }, ws);
      } else if (msg.type === 'update' && msg.id) {
        const merged = patchAnnotation(project, msg.id, msg.patch || {});
        if (merged) broadcast(project, { type: 'update', id: msg.id, patch: msg.patch }, ws);
      } else if (msg.type === 'remove' && msg.id) {
        removeAnnotation(project, msg.id);
        broadcast(project, { type: 'remove', id: msg.id }, ws);
      } else if (msg.type === 'visibility' && ws.role === 'developer') {
        setVisibility(project, Boolean(msg.enabled));
        broadcast(project, { type: 'visibility', enabled: Boolean(msg.enabled) });
      }
    });

    ws.on('close', () => {
      rooms.get(project)?.delete(ws);
    });
  });

  return wss;
}
