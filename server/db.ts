import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getTodayDate, calculateNaturalDays, calculateCarryOverDays, DEFAULT_TIMEZONE } from './time.ts';

const DATA_DIR = process.env.DAILY_FLOW_DATA_DIR || process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'daily_flow.sqlite');

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'archived';
  created_at: string;
  initial_planned_date: string;
  planned_date: string;
  completed_at: string | null;
  archived_at: string | null;
  updated_at: string;
  source: 'manual' | 'ai';
  carry_over_days?: number;
  lifecycle_days?: number;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  event_type: 'created' | 'edited' | 'rescheduled' | 'carried_over' | 'completed' | 'reopened' | 'archived' | 'restored';
  event_date: string;
  created_at: string;
  details: string;
}

let dbInstance: Database | null = null;

/**
 * Persist SQLite Database to disk using atomic rename to prevent corruption.
 * Guaranteed crash-safe: writes to a PID-stamped temporary file, flushes with fsync,
 * preserves a backup, and atomically replaces the primary file.
 */
export function persistDb(): void {
  if (!dbInstance) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = dbInstance.export();
    const buffer = Buffer.from(data);

    // Write to a temporary file in the same directory (same filesystem ensures atomic rename)
    const tempFile = path.join(DATA_DIR, `.daily_flow.tmp.${process.pid}.${Date.now()}`);
    fs.writeFileSync(tempFile, buffer);

    // Flush to physical storage
    try {
      const fd = fs.openSync(tempFile, 'r+');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch {
      // non-fatal on environments where fsync is restricted
    }

    // Keep an automatic backup of previous working file
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, `${DB_FILE}.bak`);
      } catch {
        // non-fatal
      }
    }

    // POSIX atomic rename
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[Daily Flow DB] Failed to persist database to disk:', err);
  }
}

// Hook process exit events to ensure pending changes are written
process.on('SIGINT', () => {
  persistDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  persistDb();
  process.exit(0);
});

/**
 * Initialize SQLite database and run schema migrations
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let db: Database | null = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      if (fileBuffer.length === 0) {
        throw new Error('Database file is 0 bytes');
      }
      db = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('[Daily Flow DB] Primary database file unreadable, checking backup file...', e);
      const backupFile = `${DB_FILE}.bak`;
      if (fs.existsSync(backupFile)) {
        try {
          const backupBuffer = fs.readFileSync(backupFile);
          if (backupBuffer.length > 0) {
            db = new SQL.Database(backupBuffer);
            console.log('[Daily Flow DB] Successfully recovered database from backup file.');
          }
        } catch (be) {
          console.error('[Daily Flow DB] Backup file also unreadable:', be);
        }
      }
    }
  }

  if (!db) {
    db = new SQL.Database();
  }

  // Schema creation
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      initial_planned_date TEXT NOT NULL,
      planned_date TEXT NOT NULL,
      completed_at TEXT DEFAULT NULL,
      archived_at TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      details TEXT DEFAULT '',
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks(planned_date);
    CREATE INDEX IF NOT EXISTS idx_events_task_id ON task_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_events_task_date ON task_events(task_id, event_date);
  `);

  dbInstance = db;
  persistDb();

  // Seed sample tasks if table is empty
  const countRes = db.exec("SELECT COUNT(*) as count FROM tasks;");
  const count = countRes.length > 0 && countRes[0].values[0] ? Number(countRes[0].values[0][0]) : 0;
  if (count === 0) {
    seedInitialTasks(db);
  }

  return dbInstance;
}

/**
 * Seed initial sample tasks so user sees realistic data immediately
 */
function seedInitialTasks(db: Database): void {
  const today = getTodayDate();
  const now = new Date();
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
  const nowIso = now.toISOString();

  // Task 1: A task carried over from yesterday
  const t1Id = uuidv4();
  db.run(`
    INSERT INTO tasks (id, title, description, status, created_at, initial_planned_date, planned_date, completed_at, archived_at, updated_at, source)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, ?, 'manual');
  `, [t1Id, '完成 Daily Flow 项目架构评审', '检查跨天延续机制与 SQLite 事件日志记录规范', nowIso, yesterdayStr, today, nowIso]);

  db.run(`
    INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
    VALUES (?, ?, 'created', ?, ?, '初始化创建计划');
  `, [uuidv4(), t1Id, yesterdayStr, new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()]);

  db.run(`
    INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
    VALUES (?, ?, 'carried_over', ?, ?, '跨天延续，仍未完成');
  `, [uuidv4(), t1Id, today, nowIso]);

  // Task 2: A task created today by AI agent
  const t2Id = uuidv4();
  db.run(`
    INSERT INTO tasks (id, title, description, status, created_at, initial_planned_date, planned_date, completed_at, archived_at, updated_at, source)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, ?, 'ai');
  `, [t2Id, '验证 AI 规则端点 GET /ai/rules 与 manifest.json', '通过 HTTP 测试工具调用 REST 接口验证自动化能力', nowIso, today, today, nowIso]);

  db.run(`
    INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
    VALUES (?, ?, 'created', ?, ?, '由 AI 智能体通过 REST API 自动创建');
  `, [uuidv4(), t2Id, today, nowIso]);

  // Task 3: A completed task today
  const t3Id = uuidv4();
  db.run(`
    INSERT INTO tasks (id, title, description, status, created_at, initial_planned_date, planned_date, completed_at, archived_at, updated_at, source)
    VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, NULL, ?, 'manual');
  `, [t3Id, '晨间目标规划与工作台整理', '确认今日专注要项与轻度待办清单', nowIso, today, today, nowIso, nowIso]);

  db.run(`
    INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
    VALUES (?, ?, 'created', ?, ?, '初始化创建');
  `, [uuidv4(), t3Id, today, nowIso]);

  db.run(`
    INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
    VALUES (?, ?, 'completed', ?, ?, '标记任务为已完成');
  `, [uuidv4(), t3Id, today, nowIso]);

  persistDb();
}

/**
 * Convert raw SQL row to Task object
 */
function rowToTask(columns: string[], row: any[]): Task {
  const obj: any = {};
  columns.forEach((col, idx) => {
    obj[col] = row[idx];
  });
  return {
    id: obj.id,
    title: obj.title,
    description: obj.description || '',
    status: obj.status,
    created_at: obj.created_at,
    initial_planned_date: obj.initial_planned_date,
    planned_date: obj.planned_date,
    completed_at: obj.completed_at || null,
    archived_at: obj.archived_at || null,
    updated_at: obj.updated_at,
    source: obj.source || 'manual',
  };
}

/**
 * Process cross-day tasks:
 * If an active (pending) task has planned_date < today,
 * carry it over to today, and log a 'carried_over' event idempotently.
 */
export async function processCarryOver(todayDate: string = getTodayDate()): Promise<number> {
  const db = await getDb();
  const nowIso = new Date().toISOString();

  // Find all pending tasks planned before todayDate
  const stmt = db.prepare(`SELECT * FROM tasks WHERE status = 'pending' AND planned_date < ?;`);
  stmt.bind([todayDate]);

  const carriedTasks: Task[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    const columns = stmt.getColumnNames();
    carriedTasks.push(rowToTask(columns, row));
  }
  stmt.free();

  let count = 0;
  for (const task of carriedTasks) {
    // Check if we already logged a carried_over event for this task on todayDate
    const checkStmt = db.prepare(`
      SELECT COUNT(*) as cnt FROM task_events 
      WHERE task_id = ? AND event_type = 'carried_over' AND event_date = ?;
    `);
    checkStmt.bind([task.id, todayDate]);
    let alreadyLogged = false;
    if (checkStmt.step()) {
      const res = checkStmt.get();
      alreadyLogged = Number(res[0]) > 0;
    }
    checkStmt.free();

    // Update planned_date to todayDate
    db.run(`UPDATE tasks SET planned_date = ?, updated_at = ? WHERE id = ?;`, [todayDate, nowIso, task.id]);

    if (!alreadyLogged) {
      const carryDays = calculateCarryOverDays(task.initial_planned_date, todayDate);
      const details = `跨天延续第 ${carryDays} 天，仍未完成`;
      db.run(`
        INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
        VALUES (?, ?, 'carried_over', ?, ?, ?);
      `, [uuidv4(), task.id, todayDate, nowIso, details]);
    }
    count++;
  }

  if (count > 0) {
    persistDb();
  }

  return count;
}

/**
 * Get tasks for a given date or query
 */
export async function getTasks(options: {
  date?: string;
  status?: string;
  includeCarried?: boolean;
}): Promise<Task[]> {
  const db = await getDb();
  const today = getTodayDate();
  const targetDate = options.date || today;

  // First ensure cross-day carryover is calculated if viewing today or forward
  if (targetDate >= today) {
    await processCarryOver(today);
  }

  let query = `SELECT * FROM tasks WHERE 1=1`;
  const params: any[] = [];

  if (options.status && options.status !== 'all') {
    query += ` AND status = ?`;
    params.push(options.status);
  } else {
    // Default exclude archived from daily active view unless explicit
    if (!options.status) {
      query += ` AND status != 'archived'`;
    }
  }

  if (options.date) {
    query += ` AND planned_date = ?`;
    params.push(options.date);
  }

  // Order: pending first, then completed, then by created_at DESC
  query += ` ORDER BY CASE WHEN status = 'pending' THEN 0 WHEN status = 'completed' THEN 1 ELSE 2 END, created_at ASC;`;

  const stmt = db.prepare(query);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const tasks: Task[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    const columns = stmt.getColumnNames();
    const task = rowToTask(columns, row);
    
    // Compute carry over days
    task.carry_over_days = calculateCarryOverDays(task.initial_planned_date, task.planned_date);
    
    // Compute lifecycle days
    const endDate = task.completed_at ? task.completed_at.slice(0, 10) : (task.archived_at ? task.archived_at.slice(0, 10) : today);
    task.lifecycle_days = calculateNaturalDays(task.initial_planned_date, endDate);

    tasks.push(task);
  }
  stmt.free();

  return tasks;
}

/**
 * Get a single task by ID
 */
export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDb();
  const stmt = db.prepare(`SELECT * FROM tasks WHERE id = ?;`);
  stmt.bind([id]);

  let task: Task | null = null;
  if (stmt.step()) {
    const row = stmt.get();
    const columns = stmt.getColumnNames();
    task = rowToTask(columns, row);
    const today = getTodayDate();
    task.carry_over_days = calculateCarryOverDays(task.initial_planned_date, task.planned_date);
    const endDate = task.completed_at ? task.completed_at.slice(0, 10) : (task.archived_at ? task.archived_at.slice(0, 10) : today);
    task.lifecycle_days = calculateNaturalDays(task.initial_planned_date, endDate);
  }
  stmt.free();

  return task;
}

/**
 * Create a new task
 */
export async function createTask(params: {
  title: string;
  description?: string;
  planned_date?: string;
  source?: 'manual' | 'ai';
  allow_duplicate?: boolean;
}): Promise<{ task: Task; warning?: string }> {
  const db = await getDb();
  const today = getTodayDate();
  const plannedDate = params.planned_date || today;
  const source = params.source || 'manual';
  const title = (params.title || '').trim();
  const description = (params.description || '').trim();

  if (!title) {
    throw new Error('Task title cannot be empty (任务标题不能为空)');
  }

  // Check duplicate active task on same planned_date
  if (!params.allow_duplicate) {
    const dupStmt = db.prepare(`
      SELECT id, title FROM tasks 
      WHERE title = ? AND planned_date = ? AND status != 'archived';
    `);
    dupStmt.bind([title, plannedDate]);
    if (dupStmt.step()) {
      const existing = dupStmt.get();
      dupStmt.free();
      throw new Error(`同日期 (${plannedDate}) 下已存在相同标题的任务 (ID: ${existing[0]})，如确需创建请使用 allow_duplicate 参数`);
    }
    dupStmt.free();
  }

  const id = uuidv4();
  const nowIso = new Date().toISOString();

  db.run(`
    INSERT INTO tasks (
      id, title, description, status, created_at, initial_planned_date, 
      planned_date, completed_at, archived_at, updated_at, source
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, ?, ?);
  `, [id, title, description, nowIso, plannedDate, plannedDate, nowIso, source]);

  // Log created event
  const eventDetails = source === 'ai' ? '由 AI 智能体通过规则接口创建' : '手动创建计划';
  db.run(`
    INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
    VALUES (?, ?, 'created', ?, ?, ?);
  `, [uuidv4(), id, plannedDate, nowIso, eventDetails]);

  persistDb();

  const task = (await getTaskById(id))!;
  return { task };
}

/**
 * Update an existing task
 */
export async function updateTask(id: string, updates: {
  title?: string;
  description?: string;
  planned_date?: string;
}): Promise<Task> {
  const db = await getDb();
  const current = await getTaskById(id);
  if (!current) {
    throw new Error(`Task with ID ${id} not found`);
  }

  const nowIso = new Date().toISOString();
  const today = getTodayDate();
  const title = updates.title !== undefined ? updates.title.trim() : current.title;
  const description = updates.description !== undefined ? updates.description.trim() : current.description;
  const plannedDate = updates.planned_date !== undefined ? updates.planned_date : current.planned_date;

  if (!title) {
    throw new Error('Task title cannot be empty (任务标题不能为空)');
  }

  db.run(`
    UPDATE tasks 
    SET title = ?, description = ?, planned_date = ?, updated_at = ? 
    WHERE id = ?;
  `, [title, description, plannedDate, nowIso, id]);

  // Record events
  if (plannedDate !== current.planned_date) {
    db.run(`
      INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
      VALUES (?, ?, 'rescheduled', ?, ?, ?);
    `, [uuidv4(), id, today, nowIso, `计划日期调整：${current.planned_date} -> ${plannedDate}`]);
  }

  if (title !== current.title || description !== current.description) {
    let details = '修改任务内容';
    if (title !== current.title) details += ` (原标题: "${current.title}")`;
    db.run(`
      INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
      VALUES (?, ?, 'edited', ?, ?, ?);
    `, [uuidv4(), id, today, nowIso, details]);
  }

  persistDb();
  return (await getTaskById(id))!;
}

/**
 * Toggle or set complete status of a task
 */
export async function completeTask(id: string, completed?: boolean): Promise<Task> {
  const db = await getDb();
  const current = await getTaskById(id);
  if (!current) {
    throw new Error(`Task with ID ${id} not found`);
  }

  const targetCompleted = completed !== undefined ? completed : current.status !== 'completed';
  const nowIso = new Date().toISOString();
  const today = getTodayDate();

  if (targetCompleted) {
    db.run(`
      UPDATE tasks 
      SET status = 'completed', completed_at = ?, updated_at = ? 
      WHERE id = ?;
    `, [nowIso, nowIso, id]);

    db.run(`
      INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
      VALUES (?, ?, 'completed', ?, ?, '标记任务为已完成');
    `, [uuidv4(), id, today, nowIso]);
  } else {
    db.run(`
      UPDATE tasks 
      SET status = 'pending', completed_at = NULL, updated_at = ? 
      WHERE id = ?;
    `, [nowIso, id]);

    db.run(`
      INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
      VALUES (?, ?, 'reopened', ?, ?, '重新开启未完成状态');
    `, [uuidv4(), id, today, nowIso]);
  }

  persistDb();
  return (await getTaskById(id))!;
}

/**
 * Soft delete / Archive task
 */
export async function archiveTask(id: string): Promise<Task> {
  const db = await getDb();
  const current = await getTaskById(id);
  if (!current) {
    throw new Error(`Task with ID ${id} not found`);
  }

  const nowIso = new Date().toISOString();
  const today = getTodayDate();

  db.run(`
    UPDATE tasks 
    SET status = 'archived', archived_at = ?, updated_at = ? 
    WHERE id = ?;
  `, [nowIso, nowIso, id]);

  db.run(`
    INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
    VALUES (?, ?, 'archived', ?, ?, '任务软删除并归档');
  `, [uuidv4(), id, today, nowIso]);

  persistDb();
  return (await getTaskById(id))!;
}

/**
 * Restore soft-deleted / Archived task
 */
export async function restoreTask(id: string): Promise<Task> {
  const db = await getDb();
  const current = await getTaskById(id);
  if (!current) {
    throw new Error(`Task with ID ${id} not found`);
  }

  const nowIso = new Date().toISOString();
  const today = getTodayDate();

  // If completed_at is set, restore to completed, otherwise pending
  const newStatus = current.completed_at ? 'completed' : 'pending';

  db.run(`
    UPDATE tasks 
    SET status = ?, archived_at = NULL, updated_at = ? 
    WHERE id = ?;
  `, [newStatus, nowIso, id]);

  db.run(`
    INSERT INTO task_events (id, task_id, event_type, event_date, created_at, details)
    VALUES (?, ?, 'restored', ?, ?, '恢复归档任务');
  `, [uuidv4(), id, today, nowIso]);

  persistDb();
  return (await getTaskById(id))!;
}

/**
 * Get full task event history
 */
export async function getTaskEvents(taskId: string): Promise<TaskEvent[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT * FROM task_events 
    WHERE task_id = ? 
    ORDER BY created_at ASC;
  `);
  stmt.bind([taskId]);

  const events: TaskEvent[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    const columns = stmt.getColumnNames();
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    events.push({
      id: obj.id,
      task_id: obj.task_id,
      event_type: obj.event_type,
      event_date: obj.event_date,
      created_at: obj.created_at,
      details: obj.details || '',
    });
  }
  stmt.free();

  return events;
}

/**
 * Get comprehensive history with filters and search
 */
export async function getHistory(options: {
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<Task[]> {
  const db = await getDb();
  const today = getTodayDate();

  let query = `SELECT * FROM tasks WHERE 1=1`;
  const params: any[] = [];

  if (options.status && options.status !== 'all') {
    if (options.status === 'carried_over') {
      // Carried over: pending or completed with initial_planned_date < planned_date
      query += ` AND initial_planned_date < planned_date`;
    } else {
      query += ` AND status = ?`;
      params.push(options.status);
    }
  }

  if (options.fromDate) {
    query += ` AND planned_date >= ?`;
    params.push(options.fromDate);
  }

  if (options.toDate) {
    query += ` AND planned_date <= ?`;
    params.push(options.toDate);
  }

  if (options.search) {
    query += ` AND (title LIKE ? OR description LIKE ?)`;
    const searchPattern = `%${options.search}%`;
    params.push(searchPattern, searchPattern);
  }

  query += ` ORDER BY created_at DESC;`;

  const stmt = db.prepare(query);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const tasks: Task[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    const columns = stmt.getColumnNames();
    const task = rowToTask(columns, row);
    task.carry_over_days = calculateCarryOverDays(task.initial_planned_date, task.planned_date);
    const endDate = task.completed_at ? task.completed_at.slice(0, 10) : (task.archived_at ? task.archived_at.slice(0, 10) : today);
    task.lifecycle_days = calculateNaturalDays(task.initial_planned_date, endDate);
    tasks.push(task);
  }
  stmt.free();

  return tasks;
}

/**
 * Summary stats for today
 */
export async function getTodayStats(todayDate: string = getTodayDate()): Promise<{
  total: number;
  completed: number;
  pending: number;
  carried_over: number;
  completion_rate: number;
}> {
  const tasks = await getTasks({ date: todayDate, status: 'all' });
  const activeTasks = tasks.filter(t => t.status !== 'archived');
  const completed = activeTasks.filter(t => t.status === 'completed').length;
  const pending = activeTasks.filter(t => t.status === 'pending').length;
  const carried_over = activeTasks.filter(t => (t.carry_over_days || 0) > 0).length;
  const total = activeTasks.length;
  const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    pending,
    carried_over,
    completion_rate,
  };
}
