import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Task, TaskEvent } from '../types.ts';
import { fetchHistory, fetchTaskEvents, restoreTask } from '../api.ts';

export const HistoryView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Expanded task ID for inline timeline
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<{ [id: string]: TaskEvent[] }>({});
  const [loadingTimeline, setLoadingTimeline] = useState<string | null>(null);

  const loadData = async (query = '') => {
    setLoading(true);
    try {
      const data = await fetchHistory({
        search: query.trim() || undefined,
        status: 'all',
      });
      setTasks(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadData(val);
  };

  const handleToggleExpand = async (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      return;
    }

    setExpandedTaskId(taskId);
    if (!timelineEvents[taskId]) {
      setLoadingTimeline(taskId);
      try {
        const res = await fetchTaskEvents(taskId);
        setTimelineEvents((prev) => ({ ...prev, [taskId]: res.events }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTimeline(null);
      }
    }
  };

  const handleRestore = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await restoreTask(taskId);
      await loadData(search);
      // Refresh timeline
      const res = await fetchTaskEvents(taskId);
      setTimelineEvents((prev) => ({ ...prev, [taskId]: res.events }));
    } catch (err: any) {
      console.error(err);
    }
  };

  // Convert technical events to clear human process descriptions
  const formatEventHuman = (evt: TaskEvent) => {
    const timeStr = evt.created_at ? evt.created_at.slice(0, 16).replace('T', ' ') : evt.event_date;

    switch (evt.event_type) {
      case 'created':
        return { time: timeStr, text: '创建任务' };
      case 'carried_over':
        return { time: timeStr, text: '跨天延续，仍未完成' };
      case 'rescheduled':
        return { time: timeStr, text: evt.details || '调整计划日期' };
      case 'edited':
        return { time: timeStr, text: evt.details || '修改任务内容' };
      case 'completed':
        return { time: timeStr, text: '标记完成' };
      case 'reopened':
        return { time: timeStr, text: '重新开启' };
      case 'archived':
        return { time: timeStr, text: '任务删除归档' };
      case 'restored':
        return { time: timeStr, text: '恢复任务' };
      default:
        return { time: timeStr, text: evt.details || evt.event_type };
    }
  };

  return (
    <div className="space-y-4">
      {/* Title & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F1F3F4]">
        <h1 className="text-base font-semibold text-[#202124]">历史记录</h1>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#80868B]" />
          <input
            type="text"
            placeholder="搜索任务..."
            value={search}
            onChange={handleSearchChange}
            className="w-full bg-[#F8F9FA] focus:bg-[#FFFFFF] text-[#202124] placeholder-[#80868B] pl-8 pr-3 py-1.5 rounded-lg border border-[#E8EAED] focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] outline-none text-xs transition-colors"
          />
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#80868B]">加载中...</div>
      ) : tasks.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#80868B]">暂无历史记录</div>
      ) : (
        <div className="divide-y divide-[#F1F3F4]">
          {tasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const events = timelineEvents[task.id] || [];
            const isTaskLoading = loadingTimeline === task.id;

            // Formulate status label
            let statusLabel = '进行中';
            if (task.status === 'completed' && task.completed_at) {
              statusLabel = `完成于 ${task.completed_at.slice(0, 10)}`;
            } else if (task.status === 'archived') {
              statusLabel = '已归档';
            }

            return (
              <div key={task.id} className="py-3 px-1 transition-colors">
                {/* Default Row: Title, Created Date, Status/Completed Date */}
                <div
                  onClick={() => handleToggleExpand(task.id)}
                  className="flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm break-words transition-colors group-hover:text-[#1A73E8] ${
                        task.status === 'completed'
                          ? 'text-[#80868B] line-through'
                          : task.status === 'archived'
                          ? 'text-[#9AA0A6]'
                          : 'text-[#202124]'
                      }`}
                    >
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs text-[#80868B]">
                    <span>创建于 {task.initial_planned_date || task.created_at.slice(0, 10)}</span>
                    <span className={task.status === 'completed' ? 'text-[#1E8E3E]' : ''}>
                      {statusLabel}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-[#5F6368]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[#5F6368]" />
                    )}
                  </div>
                </div>

                {/* Expanded Human Process Timeline */}
                {isExpanded && (
                  <div className="mt-3 pt-3 pl-3 border-l-2 border-[#E8EAED] ml-2 text-xs text-[#5F6368] space-y-2">
                    {task.description && (
                      <div className="mb-2 text-[#3C4043]">
                        <span className="text-[#80868B]">描述：</span>
                        {task.description}
                      </div>
                    )}

                    {isTaskLoading ? (
                      <div className="text-[#80868B] py-1">加载过程记录...</div>
                    ) : events.length === 0 ? (
                      <div className="text-[#80868B] py-1">暂无详细记录</div>
                    ) : (
                      <div className="space-y-1.5">
                        {events.map((evt, idx) => {
                          const item = formatEventHuman(evt);
                          return (
                            <div key={evt.id || idx} className="flex items-start gap-3">
                              <span className="text-[#80868B] tabular-nums shrink-0 font-mono">
                                {item.time}
                              </span>
                              <span className="text-[#202124]">{item.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {task.status === 'archived' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={(e) => handleRestore(task.id, e)}
                          className="flex items-center gap-1 text-xs text-[#1E8E3E] hover:underline cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>恢复此任务至今日</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
