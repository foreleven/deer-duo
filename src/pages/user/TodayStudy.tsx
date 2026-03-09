import { useState, useEffect, useCallback } from "react";
import type { Subject, Chapter, Lesson, StudyRecord } from "../../types";
import { SUBJECT_COLORS } from "../../types";

interface TodayStudyProps {
  onViewLesson: (recordId: number) => void;
}

export default function TodayStudy({ onViewLesson }: TodayStudyProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    try {
      const r = await fetch(`/api/study-records?date=${today}`);
      const data = (await r.json()) as { records: StudyRecord[] };
      setRecords(data.records);
    } catch {
      setError("加载今日学习记录失败");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleRemoveRecord = async (recordId: number) => {
    if (!confirm("确认取消绑定该课时？")) return;
    await fetch(`/api/study-records/${recordId}`, { method: "DELETE" });
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
  };

  const statusLabel = (s: StudyRecord["status"]) =>
    ({ pending: "未开始", in_progress: "进行中", done: "已完成" })[s];
  const statusColor = (s: StudyRecord["status"]) =>
    ({
      pending: "bg-gray-100 text-gray-500",
      in_progress: "bg-yellow-100 text-yellow-700",
      done: "bg-green-100 text-green-700",
    })[s];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">今日学习</h2>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => setShowAddLesson(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + 添加课时
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Study records */}
      {records.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-gray-500 text-sm">今天还没有学习计划</p>
          <p className="text-gray-400 text-xs mt-1">点击「添加课时」开始今天的学习</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4"
            >
              {/* Subject badge */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                  SUBJECT_COLORS[rec.subject_code ?? ""] ?? "bg-gray-100 text-gray-500"
                }`}
              >
                {rec.subject_name?.slice(0, 1)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onViewLesson(rec.id)}
                  className="font-medium text-gray-800 hover:text-indigo-600 text-left truncate block w-full"
                >
                  {rec.lesson_title}
                </button>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{rec.subject_name}</span>
                  {rec.chapter_title && (
                    <>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400">{rec.chapter_title}</span>
                    </>
                  )}
                  {(rec.task_total ?? 0) > 0 && (
                    <>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400">
                        任务 {rec.task_done}/{rec.task_total}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Status & actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(rec.status)}`}>
                  {statusLabel(rec.status)}
                </span>
                <button
                  onClick={() => onViewLesson(rec.id)}
                  className="text-xs text-indigo-500 hover:text-indigo-700"
                >
                  查看
                </button>
                <button
                  onClick={() => handleRemoveRecord(rec.id)}
                  className="text-xs text-gray-300 hover:text-red-500"
                >
                  移除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add lesson modal */}
      {showAddLesson && (
        <AddLessonModal
          today={today}
          existingLessonIds={records.map((r) => r.lesson_id)}
          onClose={() => setShowAddLesson(false)}
          onAdded={() => {
            setShowAddLesson(false);
            loadRecords();
          }}
        />
      )}
    </div>
  );
}

// ── Add Lesson Modal ──────────────────────────────────────────────────────────

function AddLessonModal({
  today,
  existingLessonIds,
  onClose,
  onAdded,
}: {
  today: string;
  existingLessonIds: number[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessonsByChapter, setLessonsByChapter] = useState<Record<number, Lesson[]>>({});
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json() as Promise<{ subjects: Subject[] }>)
      .then(({ subjects }) => {
        setSubjects(subjects);
        if (subjects.length) setActiveSubjectId(subjects[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeSubjectId) return;
    setChapters([]);
    setLessonsByChapter({});
    setExpandedChapters(new Set());
    fetch(`/api/subjects/${activeSubjectId}/chapters`)
      .then((r) => r.json() as Promise<{ chapters: Chapter[] }>)
      .then(({ chapters }) => setChapters(chapters));
  }, [activeSubjectId]);

  const loadLessons = async (chapterId: number) => {
    if (lessonsByChapter[chapterId] !== undefined) return;
    const r = await fetch(`/api/chapters/${chapterId}/lessons`);
    const { lessons } = (await r.json()) as { lessons: Lesson[] };
    setLessonsByChapter((prev) => ({ ...prev, [chapterId]: lessons }));
  };

  const toggleChapter = async (chapterId: number) => {
    const next = new Set(expandedChapters);
    if (next.has(chapterId)) {
      next.delete(chapterId);
    } else {
      next.add(chapterId);
      await loadLessons(chapterId);
    }
    setExpandedChapters(next);
  };

  const handleAdd = async (lessonId: number) => {
    setAdding(lessonId);
    try {
      await fetch("/api/study-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, study_date: today }),
      });
      onAdded();
    } finally {
      setAdding(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">添加课时到今天</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            ×
          </button>
        </div>

        {/* Subject tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-gray-100">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSubjectId(s.id)}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeSubjectId === s.id
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && chapters.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">该学科暂无章节</p>
          )}
          {chapters.map((ch) => (
            <div key={ch.id} className="border border-gray-100 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleChapter(ch.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="text-gray-400 text-xs">
                  {expandedChapters.has(ch.id) ? "▼" : "▶"}
                </span>
                <span className="text-sm font-medium text-gray-700">{ch.title}</span>
              </button>
              {expandedChapters.has(ch.id) && (
                <ul className="border-t border-gray-50 divide-y divide-gray-50">
                  {(lessonsByChapter[ch.id] ?? []).length === 0 ? (
                    <li className="text-xs text-gray-400 text-center py-3">暂无课时</li>
                  ) : (
                    (lessonsByChapter[ch.id] ?? []).map((lesson) => {
                      const alreadyAdded = existingLessonIds.includes(lesson.id);
                      return (
                        <li
                          key={lesson.id}
                          className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50"
                        >
                          <span className="flex-1 text-sm text-gray-700 truncate">
                            {lesson.title}
                          </span>
                          {alreadyAdded ? (
                            <span className="text-xs text-gray-400">已添加</span>
                          ) : (
                            <button
                              onClick={() => handleAdd(lesson.id)}
                              disabled={adding === lesson.id}
                              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg disabled:opacity-50"
                            >
                              {adding === lesson.id ? "添加中..." : "+ 添加"}
                            </button>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
