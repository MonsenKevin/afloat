import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/index';
import { runSeed } from './db/seed';
import { loadKbDocuments } from './services/kbLoader';
import { initVectorStore } from './services/vectorStore';
import authRouter from './routes/auth';
import checkinsRouter from './routes/checkins';
import kbRouter from './routes/kb';
import githubRouter from './routes/github';
import managerRouter from './routes/manager';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'afloat-backend' });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/kb', kbRouter);
app.use('/api/github', githubRouter);
app.use('/api/manager', managerRouter);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

async function start() {
  await initDb();
  await runSeed();

  // Initialize vector store from KB documents
  try {
    const docs = loadKbDocuments();
    if (docs.length > 0) {
      await initVectorStore(docs);
    } else {
      console.warn('No KB documents found — vector store not initialized.');
    }
  } catch (err) {
    console.error('Failed to initialize vector store:', err);
    // Non-fatal: server continues without KB search
  }

  app.listen(PORT, () => {
    console.log(`Afloat backend listening on port ${PORT}`);
  });
}

start().catch(console.error);

export default app;
