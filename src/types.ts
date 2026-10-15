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

export interface TodayStats {
  total: number;
  completed: number;
  pending: number;
  carried_over: number;
  completion_rate: number;
}
