import React, { useState, useEffect, useCallback } from 'react';
import { Task } from './types.ts';
import {
  fetchTasks,
  createTask,
  updateTask,
  toggleTaskComplete,
  archiveTask,
} from './api.ts';
import { Header } from './components/Header.tsx';
import { TaskInput } from './components/TaskInput.tsx';
import { TaskItem } from './components/TaskItem.tsx';
import { TaskEditModal } from './components/TaskEditModal.tsx';
import { HistoryView } from './components/HistoryView.tsx';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'today' | 'history'>('today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Load today's active tasks
  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentTab === 'today') {
      loadTasks();
    }
  }, [currentTab, loadTasks]);

  // Add task
  const handleAddTask = async (title: string) => {
    try {
      await createTask({ title, source: 'manual' });
      await loadTasks();
    } catch (err: any) {
      console.error(err);
    }
  };

  // Toggle complete: completed tasks automatically sort below pending tasks
  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    const isNowCompleted = currentStatus !== 'completed';

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: isNowCompleted ? 'completed' : 'pending' } : t))
    );

    try {
      await toggleTaskComplete(taskId, isNowCompleted);
      await loadTasks();
    } catch (err) {
      console.error(err);
      await loadTasks();
    }
  };

  // Delete task (soft delete, disappears from today's list)
  const handleDeleteTask = async (task: Task) => {
    // Optimistic UI update: disappears immediately
    setTasks((prev) => prev.filter((t) => t.id !== task.id));

    try {
      await archiveTask(task.id);
      await loadTasks();
    } catch (err) {
      console.error(err);
      await loadTasks();
    }
  };

  // Save edits (title & description)
  const handleSaveEdit = async (
    id: string,
    updates: { title: string; description: string; planned_date: string }
  ) => {
    try {
      await updateTask(id, updates);
      await loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  // Sort: Pending tasks first, completed tasks below
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const sortedTasks = [...pendingTasks, ...completedTasks];

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#202124] flex flex-col font-sans">
      {/* 1. Header: Daily Flow brand & 2 Navigation entries */}
      <Header currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* 2. Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        {currentTab === 'today' ? (
          <div>
            {/* Task Input Box with Add Button */}
            <TaskInput onAddTask={handleAddTask} />

            {/* Task List */}
            {loading ? (
              <div className="py-12 text-center text-xs text-[#80868B]">加载中...</div>
            ) : sortedTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#80868B]">
                暂无任务
              </div>
            ) : (
              <div className="divide-y divide-[#F1F3F4]">
                {sortedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={(t) => setEditingTask(t)}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <HistoryView />
        )}
      </main>

      {/* Edit Modal (title and description) */}
      <TaskEditModal
        task={editingTask}
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
