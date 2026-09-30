import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import colyseusPkg from 'colyseus';
import wsTransportPkg from '@colyseus/ws-transport';
import { GreatCollapseRoom } from './rooms/GreatCollapseRoom.js';

const { Server } = colyseusPkg;
const { WebSocketTransport } = wsTransportPkg;

const port = Number(process.env.PORT) || 2567;

const app = express();
app.use(cors());
app.use(express.json());
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('great_collapse', GreatCollapseRoom);

gameServer.listen(port);
console.log(`[golemians-game-server] listening on :${port}`);
