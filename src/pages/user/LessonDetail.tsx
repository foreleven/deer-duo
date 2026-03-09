import { useState, useEffect, useRef, useCallback } from "react";
import type { StudyRecord, Task } from "../../types";
import { TASK_TYPE_LABELS } from "../../types";

interface LessonDetailProps {
  recordId: number;
  onBack: () => void;
}

type Tab = "tasks" | "content" | "ai";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function LessonDetail({ recordId, onBack }: LessonDetailProps) {
  const [record, setRecord] = useState<StudyRecord | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<Tab>("tasks");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [recRes, taskRes] = await Promise.all([
        fetch(`/api/study-records?date=${new Date().toISOString().slice(0, 10)}`),
        fetch(`/api/study-records/${recordId}/tasks`),
      ]);
      const recData = (await recRes.json()) as { records: StudyRecord[] };
      const taskData = (await taskRes.json()) as { tasks: Task[] };

      const found = recData.records.find((r) => r.id === recordId) ?? null;
      setRecord(found);
      setTasks(taskData.tasks);
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAddTask = async (taskType: Task["task_type"], note: string) => {
    const r = await fetch(`/api/study-records/${recordId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_type: taskType, note: note || null }),
    });
    const data = (await r.json()) as { task: Task };
    setTasks((prev) => [...prev, data.task]);
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === "done" ? "pending" : "done";
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null } : t,
      ),
    );
    // Update record status
    loadAll();
  };

  const handleDeleteTask = async (taskId: number) => {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    loadAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">{error || "记录不存在"}</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 text-sm">
          返回
        </button>
      </div>
    );
  }

  const doneTasks = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 mt-0.5">
          ← 返回
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 truncate">{record.lesson_title}</h2>
          <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-400">
            <span>{record.subject_name}</span>
            {record.chapter_title && (
              <>
                <span>·</span>
                <span>{record.chapter_title}</span>
              </>
            )}
            {tasks.length > 0 && (
              <>
                <span>·</span>
                <span>
                  {doneTasks}/{tasks.length} 任务完成
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            { key: "tasks", label: "学习任务" },
            { key: "content", label: "课时内容" },
            { key: "ai", label: "🤖 AI 辅导" },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "tasks" && (
        <TasksPanel
          tasks={tasks}
          onToggle={handleToggleTask}
          onDelete={handleDeleteTask}
          onAdd={handleAddTask}
        />
      )}
      {tab === "content" && (
        <ContentPanel content={record.lesson_content ?? null} />
      )}
      {tab === "ai" && (
        <AiChatPanel recordId={recordId} />
      )}
    </div>
  );
}

// ── Tasks Panel ───────────────────────────────────────────────────────────────

function TasksPanel({
  tasks,
  onToggle,
  onDelete,
  onAdd,
}: {
  tasks: Task[];
  onToggle: (task: Task) => void;
  onDelete: (taskId: number) => void;
  onAdd: (type: Task["task_type"], note: string) => void;
}) {
  const [newType, setNewType] = useState<Task["task_type"]>("homework");
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await onAdd(newType, newNote);
      setNewNote("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">暂无任务，请在下方添加</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm ${
                task.status === "done" ? "opacity-60" : ""
              }`}
            >
              <button
                onClick={() => onToggle(task)}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  task.status === "done"
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-gray-300 hover:border-indigo-400"
                }`}
              >
                {task.status === "done" && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm font-medium ${
                    task.status === "done" ? "line-through text-gray-400" : "text-gray-800"
                  }`}
                >
                  {TASK_TYPE_LABELS[task.task_type]}
                </span>
                {task.note && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{task.note}</p>
                )}
              </div>
              <button
                onClick={() => onDelete(task.id)}
                className="text-gray-200 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add task form */}
      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm px-4 py-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-700">添加任务</h4>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(TASK_TYPE_LABELS) as [Task["task_type"], string][]).map(
            ([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => setNewType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  newType === type
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="备注（可选）"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg"
          >
            {adding ? "..." : "添加"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Content Panel ─────────────────────────────────────────────────────────────

function ContentPanel({ content }: { content: string | null }) {
  return (
    <div className="bg-white rounded-xl shadow-sm px-6 py-5">
      {content ? (
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      ) : (
        <p className="text-gray-400 text-sm text-center py-8">暂无课时内容</p>
      )}
    </div>
  );
}

// ── AI Chat Panel ─────────────────────────────────────────────────────────────

function AiChatPanel({ recordId }: { recordId: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || streaming) return;

    setInput("");
    setStreaming(true);

    // Append user message + empty assistant placeholder atomically
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      { role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/study-records/${recordId}/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `❌ ${data.error ?? "请求失败"}` };
          return next;
        });
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload) as { response?: string };
            assembled += parsed.response ?? "";
            const snapshot = assembled;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: snapshot };
              return next;
            });
          } catch {
            // skip malformed SSE chunk
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: "❌ AI 服务暂不可用，请稍后重试" };
          return next;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm flex flex-col" style={{ height: "420px" }}>
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <div className="text-3xl">🤖</div>
            <p className="text-sm text-gray-500">AI 辅导老师在线</p>
            <p className="text-xs text-gray-400">可以问我关于今天课时的任何问题，或让我出练习题</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {msg.content || (
                <span className="flex gap-1 items-center text-gray-400">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            placeholder="输入你的问题..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
          >
            发送
          </button>
        </form>
      </div>
    </div>
  );
}
