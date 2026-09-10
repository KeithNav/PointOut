import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.POINTOUT_DB_PATH || path.join(process.cwd(), 'data', 'pointout.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    page TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_annotations_project ON annotations(project);

  CREATE TABLE IF NOT EXISTS project_state (
    project TEXT PRIMARY KEY,
    visible INTEGER NOT NULL DEFAULT 1
  );
`);

export function listAnnotations(project) {
  const rows = db.prepare('SELECT data FROM annotations WHERE project = ? ORDER BY created_at ASC').all(project);
  return rows.map((r) => JSON.parse(r.data));
}

export function upsertAnnotation(project, annotation) {
  db.prepare(
    `INSERT INTO annotations (id, project, page, type, data, created_at)
     VALUES (@id, @project, @page, @type, @data, @created_at)
     ON CONFLICT(id) DO UPDATE SET data = @data, page = @page, type = @type`,
  ).run({
    id: annotation.id,
    project,
    page: annotation.page,
    type: annotation.type,
    data: JSON.stringify(annotation),
    created_at: annotation.createdAt,
  });
}

export function patchAnnotation(project, id, patch) {
  const row = db.prepare('SELECT data FROM annotations WHERE id = ? AND project = ?').get(id, project);
  if (!row) return null;
  const merged = { ...JSON.parse(row.data), ...patch };
  db.prepare('UPDATE annotations SET data = ? WHERE id = ? AND project = ?').run(JSON.stringify(merged), id, project);
  return merged;
}

export function removeAnnotation(project, id) {
  db.prepare('DELETE FROM annotations WHERE id = ? AND project = ?').run(id, project);
}

export function getVisibility(project) {
  const row = db.prepare('SELECT visible FROM project_state WHERE project = ?').get(project);
  return row ? Boolean(row.visible) : true;
}

export function setVisibility(project, enabled) {
  db.prepare(
    `INSERT INTO project_state (project, visible) VALUES (?, ?)
     ON CONFLICT(project) DO UPDATE SET visible = excluded.visible`,
  ).run(project, enabled ? 1 : 0);
}
