import express from 'express';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { config } from 'dotenv';
import { basicAuth } from './middleware/auth.js';
import channelRoutes from './routes/channels.js';
import queueRoutes from './routes/queue.js';
import pipelineRoutes from './routes/pipeline.js';
import historyRoutes from './routes/history.js';
import oauthRoutes from './routes/oauth.js';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT ?? '3000', 10);

app.use(express.json());
app.use(basicAuth);
app.use(express.static(resolve(__dirname, '..', 'public')));

// API routes
app.use('/api/channels', channelRoutes);
app.use('/api/channels', queueRoutes);
app.use('/api/channels', historyRoutes);
app.use('/api/pipelines', pipelineRoutes);

app.use('/api/channels', oauthRoutes);

// Produce endpoint lives under channels but needs pipeline logic
app.use('/api/channels', pipelineRoutes);

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
