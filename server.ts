import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { runMigrations } from './server/db';
import { seedDatabase } from './server/seed';
import { attachUser } from './server/auth';
import { createApiRouter } from './server/routes';

const PORT = 3000;

async function startServer() {
  runMigrations();
  seedDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '14mb' }));
  app.use(attachUser);

  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian Assessment server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Meridian Assessment server:', err);
  process.exit(1);
});
