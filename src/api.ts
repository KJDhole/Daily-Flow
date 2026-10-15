import { Task, TaskEvent, TodayStats } from './types.ts';

const API_BASE = '/api';

export async function fetchTasks(date?: string, status?: string): Promise<Task[]> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (status) params.append('status', status);

  const res = await fetch(`${API_BASE}/tasks?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return data.data || [];
}

export async function createTask(payload: {
  title: string;
  description?: string;
  planned_date?: string;
  source?: 'manual' | 'ai';
  allow_duplicate?: boolean;
}): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create task');
  }
  return data.task;
}

export async function updateTask(id: string, payload: {
  title?: string;
  description?: string;
  planned_date?: string;
}): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update task');
  }
  return data.task;
}

export async function toggleTaskComplete(id: string, completed?: boolean): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to toggle complete');
  }
  return data.task;
}

export async function archiveTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}/archive`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to archive task');
  }
  return data.task;
}

export async function restoreTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}/restore`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to restore task');
  }
  return data.task;
}

export async function fetchHistory(filters?: {
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters?.fromDate) params.append('from_date', filters.fromDate);
  if (filters?.toDate) params.append('to_date', filters.toDate);

  const res = await fetch(`${API_BASE}/history?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return data.data || [];
}

export async function fetchTaskEvents(taskId: string): Promise<{ task: Task; events: TaskEvent[] }> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/events`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return { task: data.task, events: data.data || [] };
}

export async function fetchTodayStats(date?: string): Promise<TodayStats> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  const res = await fetch(`${API_BASE}/stats/today?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  const data = await res.json();
  return data.data;
}

export async function triggerCarryover(date?: string): Promise<{ count: number; date: string }> {
  const res = await fetch(`${API_BASE}/carryover/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  });
  const data = await res.json();
  return { count: data.carried_count || 0, date: data.date };
}
