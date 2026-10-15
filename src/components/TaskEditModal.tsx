import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Task } from '../types.ts';

interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: { title: string; description: string; planned_date: string }) => Promise<void>;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(task.id, {
        title: title.trim(),
        description: description.trim(),
        planned_date: task.planned_date,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-[#FFFFFF] w-full max-w-md rounded-xl border border-[#E8EAED] shadow-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F3F4]">
          <h2 className="text-sm font-semibold text-[#202124]">
            编辑任务
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#5F6368] hover:text-[#202124] rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="edit-task-title" className="block text-xs font-medium text-[#5F6368] mb-1">
              任务名称
            </label>
            <input
              id="edit-task-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#F8F9FA] focus:bg-[#FFFFFF] text-[#202124] px-3 py-2 rounded-lg border border-[#DADCE0] focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] outline-none text-sm transition-colors"
            />
          </div>

          <div>
            <label htmlFor="edit-task-desc" className="block text-xs font-medium text-[#5F6368] mb-1">
              描述与备注
            </label>
            <textarea
              id="edit-task-desc"
              rows={3}
              placeholder="暂无描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#F8F9FA] focus:bg-[#FFFFFF] text-[#202124] placeholder-[#BDC1C6] px-3 py-2 rounded-lg border border-[#DADCE0] focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] outline-none text-sm transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-medium text-[#5F6368] hover:text-[#202124] rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="px-4 py-1.5 bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? '保存中' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
