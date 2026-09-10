import { Router } from 'express';
import { listAnnotations, getVisibility } from './db.js';

export function createRouter({ apiKey }) {
  const router = Router();

  function checkAuth(req, res, next) {
    if (!apiKey) return next();
    const token = req.header('x-api-key') || req.query.token;
    if (token !== apiKey) return res.status(401).json({ error: 'Invalid API key' });
    next();
  }

  router.get('/health', (req, res) => res.json({ ok: true }));

  // Optional REST snapshot endpoint, handy for server-rendered dashboards; live updates still go through /ws.
  router.get('/projects/:project/annotations', checkAuth, (req, res) => {
    res.json({
      annotations: listAnnotations(req.params.project),
      visible: getVisibility(req.params.project),
    });
  });

  return router;
}
