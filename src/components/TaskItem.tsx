import React from 'react';
import { Check, Edit2, Trash2 } from 'lucide-react';
import { Task } from '../types.ts';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string, currentStatus: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  isProcessing?: boolean;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  isProcessing = false,
}) => {
  const isCompleted = task.status === 'completed';

  return (
    <div
      data-testid={`task-row-${task.id}`}
      className="group flex items-center justify-between py-3 px-1 border-b border-[#F1F3F4] transition-colors hover:bg-[#FAFAFA]/80 rounded-sm"
    >
      {/* Left: Completion Checkbox & Middle: Task Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={isCompleted}
          aria-label={isCompleted ? `取消完成：${task.title}` : `标记完成：${task.title}`}
          data-testid={`task-checkbox-${task.id}`}
          disabled={isProcessing}
          onClick={() => onToggleComplete(task.id, task.status)}
          className={`w-4.5 h-4.5 rounded flex items-center justify-center shrink-0 border transition-colors cursor-pointer ${
            isCompleted
              ? 'bg-[#1E8E3E] border-[#1E8E3E] text-white'
              : 'border-[#BDC1C6] hover:border-[#1A73E8] bg-white'
          }`}
        >
          {isCompleted && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
        </button>

        <span
          onClick={() => onEdit(task)}
          className={`text-sm break-words cursor-pointer select-none transition-colors ${
            isCompleted ? 'text-[#80868B] line-through' : 'text-[#202124]'
          }`}
        >
          {task.title}
        </span>
      </div>

      {/* Right: Low-profile Edit and Delete icons */}
      <div className="flex items-center gap-1 shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label={`编辑：${task.title}`}
          data-testid={`task-edit-${task.id}`}
          className="p-1.5 text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] rounded transition-colors cursor-pointer"
          title="编辑"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`删除：${task.title}`}
          data-testid={`task-archive-${task.id}`}
          className="p-1.5 text-[#5F6368] hover:text-[#D93025] hover:bg-[#FCE8E6] rounded transition-colors cursor-pointer"
          title="删除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
