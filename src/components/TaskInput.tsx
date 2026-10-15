import React, { useState } from 'react';

interface TaskInputProps {
  onAddTask: (title: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const TaskInput: React.FC<TaskInputProps> = ({ onAddTask, isSubmitting = false }) => {
  const [title, setTitle] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    const trimmed = title.trim();
    try {
      await onAddTask(trimmed);
      setTitle('');
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex items-center gap-2">
        <label htmlFor="task-title-input" className="sr-only">
          任务标题
        </label>
        <input
          id="task-title-input"
          data-testid="add-task-input"
          type="text"
          placeholder="添加新任务..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
          className="flex-1 bg-[#F8F9FA] hover:bg-[#F1F3F4] focus:bg-[#FFFFFF] text-[#202124] placeholder-[#80868B] px-3.5 py-2.5 rounded-lg border border-[#E8EAED] focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] outline-none text-sm transition-colors"
        />
        <button
          type="submit"
          id="add-task-submit"
          data-testid="add-task-submit"
          disabled={isSubmitting || !title.trim()}
          className="px-4 py-2.5 bg-[#1A73E8] hover:bg-[#1557B0] active:bg-[#174EA6] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
        >
          {isSubmitting ? '添加中' : '添加'}
        </button>
      </div>
    </form>
  );
};
