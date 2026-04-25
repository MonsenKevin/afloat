// Load env FIRST before any other imports that read process.env
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { initDb } from './db/index';
import { runSeed } from './db/seed';
import { loadKbDocuments, setKbDocuments } from './services/kbLoader';
import authRouter from './routes/auth';
import checkinsRouter from './routes/checkins';
import kbRouter from './routes/kb';
import githubRouter from './routes/github';
import managerRouter from './routes/manager';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'afloat-backend' });
});

app.use('/api/auth', authRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/kb', kbRouter);
app.use('/api/github', githubRouter);
app.use('/api/manager', managerRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  await initDb();
  await runSeed();

  // Load KB docs into memory for Claude-based search
  try {
    const docs = loadKbDocuments();
    setKbDocuments(docs);
    console.log(`KB loaded: ${docs.length} documents.`);
  } catch (err) {
    console.error('Failed to load KB documents:', err);
  }

  app.listen(PORT, () => {
    console.log(`Afloat backend listening on port ${PORT}`);
    console.log(`ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}`);
  });
}

start().catch(console.error);

export default app;
