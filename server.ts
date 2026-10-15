import express from 'express';
import path from 'path';
import fs from 'fs';
import { getTodayDate } from './server/time.ts';
import {
  getDb,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  completeTask,
  archiveTask,
  restoreTask,
  getHistory,
  getTaskEvents,
  getTodayStats,
  processCarryOver,
} from './server/db.ts';
import { AI_RULES_MARKDOWN, AI_MANIFEST_JSON, renderRulesHtml } from './server/ai_rules.ts';

async function startServer() {
  // Initialize Database
  await getDb();

  const app = express();
  app.use(express.json());

  // CORS and AI access headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // --------------------------------------------------------------------------
  // AI Public Endpoints (GET /ai/rules, GET /ai/manifest.json)
  // --------------------------------------------------------------------------
  app.get('/ai/rules', (req, res) => {
    const format = req.query.format;
    const accept = req.headers.accept || '';

    if (format === 'raw' || format === 'text' || format === 'markdown' || accept.includes('text/markdown') || (!accept.includes('text/html') && accept.includes('text/plain'))) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(AI_RULES_MARKDOWN);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderRulesHtml());
  });

  app.get('/ai/manifest.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(AI_MANIFEST_JSON);
  });

  // --------------------------------------------------------------------------
  // API Endpoints
  // --------------------------------------------------------------------------

  // GET /api/tasks - Query daily tasks
  app.get('/api/tasks', async (req, res) => {
    try {
      const date = (req.query.date as string) || getTodayDate();
      const status = req.query.status as string;
      const tasks = await getTasks({ date, status });
      res.json({
        success: true,
        date,
        total: tasks.length,
        data: tasks,
      });
    } catch (err: any) {
      console.error('Error in GET /api/tasks:', err);
      res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
    }
  });

  // POST /api/tasks - Create task
  app.post('/api/tasks', async (req, res) => {
    try {
      const { title, description, planned_date, source, allow_duplicate } = req.body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ success: false, error: 'Task title is required (任务标题为必填项)' });
      }

      const result = await createTask({
        title,
        description,
        planned_date,
        source: source === 'ai' ? 'ai' : 'manual',
        allow_duplicate: Boolean(allow_duplicate),
      });

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        task: result.task,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('已存在相同标题的任务')) {
        return res.status(409).json({ success: false, error: err.message, code: 'DUPLICATE_TASK' });
      }
      console.error('Error in POST /api/tasks:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to create task' });
    }
  });

  // PATCH /api/tasks/:id - Update task
  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, planned_date } = req.body;
      const updated = await updateTask(id, { title, description, planned_date });
      res.json({
        success: true,
        message: 'Task updated successfully',
        task: updated,
      });
    } catch (err: any) {
      console.error(`Error in PATCH /api/tasks/${req.params.id}:`, err);
      const status = err.message && err.message.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to update task' });
    }
  });

  // POST /api/tasks/:id/complete - Toggle or set completion
  app.post('/api/tasks/:id/complete', async (req, res) => {
    try {
      const { id } = req.params;
      const completed = req.body?.completed !== undefined ? Boolean(req.body.completed) : undefined;
      const task = await completeTask(id, completed);
      res.json({
        success: true,
        message: task.status === 'completed' ? 'Task marked as completed' : 'Task reopened as pending',
        task,
      });
    } catch (err: any) {
      console.error(`Error in POST /api/tasks/${req.params.id}/complete:`, err);
      const status = err.message && err.message.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to complete task' });
    }
  });

  // POST /api/tasks/:id/archive - Soft delete
  app.post('/api/tasks/:id/archive', async (req, res) => {
    try {
      const { id } = req.params;
      const task = await archiveTask(id);
      res.json({
        success: true,
        message: 'Task archived successfully (已软删除归档)',
        task,
      });
    } catch (err: any) {
      console.error(`Error in POST /api/tasks/${req.params.id}/archive:`, err);
      const status = err.message && err.message.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to archive task' });
    }
  });

  // POST /api/tasks/:id/restore - Restore soft deleted
  app.post('/api/tasks/:id/restore', async (req, res) => {
    try {
      const { id } = req.params;
      const task = await restoreTask(id);
      res.json({
        success: true,
        message: 'Task restored successfully (已恢复任务)',
        task,
      });
    } catch (err: any) {
      console.error(`Error in POST /api/tasks/${req.params.id}/restore:`, err);
      const status = err.message && err.message.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to restore task' });
    }
  });

  // GET /api/history - Historical tasks
  app.get('/api/history', async (req, res) => {
    try {
      const search = req.query.search as string;
      const status = req.query.status as string;
      const fromDate = req.query.from_date as string;
      const toDate = req.query.to_date as string;

      const tasks = await getHistory({ search, status, fromDate, toDate });
      res.json({
        success: true,
        total: tasks.length,
        data: tasks,
      });
    } catch (err: any) {
      console.error('Error in GET /api/history:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch history' });
    }
  });

  // GET /api/tasks/:id/events - Timeline audit events
  app.get('/api/tasks/:id/events', async (req, res) => {
    try {
      const { id } = req.params;
      const task = await getTaskById(id);
      if (!task) {
        return res.status(404).json({ success: false, error: `Task ${id} not found` });
      }
      const events = await getTaskEvents(id);
      res.json({
        success: true,
        task,
        data: events,
      });
    } catch (err: any) {
      console.error(`Error in GET /api/tasks/${req.params.id}/events:`, err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch events' });
    }
  });

  // GET /api/stats/today - Today's progress statistics
  app.get('/api/stats/today', async (req, res) => {
    try {
      const date = (req.query.date as string) || getTodayDate();
      const stats = await getTodayStats(date);
      res.json({
        success: true,
        date,
        data: stats,
      });
    } catch (err: any) {
      console.error('Error in GET /api/stats/today:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch stats' });
    }
  });

  // POST /api/carryover/trigger - Manually trigger or simulate cross-day check
  app.post('/api/carryover/trigger', async (req, res) => {
    try {
      const targetDate = req.body?.date || req.query.date || getTodayDate();
      const carriedCount = await processCarryOver(String(targetDate));
      res.json({
        success: true,
        date: targetDate,
        carried_count: carriedCount,
        message: `Cross-day carryover processed: ${carriedCount} tasks carried over to ${targetDate}`,
      });
    } catch (err: any) {
      console.error('Error in POST /api/carryover/trigger:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /health - Lightweight health & memory check for monitoring / systemd
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'daily-flow',
      uptime_seconds: Math.round(process.uptime()),
      memory_rss_mb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      memory_heap_used_mb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
    });
  });

  // --------------------------------------------------------------------------
  // Frontend Vite middleware (Dev) or High-performance Static Serving (Prod)
  // --------------------------------------------------------------------------
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      // Static hashed assets cached for 1 year, index.html not cached
      app.use(express.static(distPath, {
        maxAge: '1y',
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      }));

      // SPA fallback
      app.get('*', (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[Daily Flow] Warning: dist folder not found. Please run "npm run build" first.');
    }
  }

  process.title = 'daily-flow';
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Daily Flow] Server listening on http://0.0.0.0:${PORT} (ENV: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Daily Flow] Failed to start server:', err);
  process.exit(1);
});
