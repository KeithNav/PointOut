import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { createRouter } from './routes.js';
import { attachWebSocketServer } from './ws.js';

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.POINTOUT_API_KEY || '';
const ORIGINS = (process.env.POINTOUT_CORS_ORIGINS || '*').split(',').map((s) => s.trim());

const app = express();
app.use(cors({ origin: ORIGINS.includes('*') ? true : ORIGINS }));
app.use(express.json());
app.use('/api', createRouter({ apiKey: API_KEY }));

const server = http.createServer(app);
attachWebSocketServer(server, { apiKey: API_KEY });

server.listen(PORT, () => {
  console.log(`PointOut relay server listening on port ${PORT}`);
  if (!API_KEY) {
    console.warn('WARNING: POINTOUT_API_KEY is not set - the server is accepting unauthenticated connections.');
  }
});
