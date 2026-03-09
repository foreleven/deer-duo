import { useState, useEffect, useCallback } from "react";
import type { Subject, Chapter, Lesson } from "../../types";

interface CourseManagementProps {
  onBack: () => void;
}

type Modal =
  | { type: "chapter-create"; subjectId: number }
  | { type: "chapter-edit"; chapter: Chapter }
  | { type: "lesson-create"; chapterId: number; chapterTitle: string }
  | { type: "lesson-edit"; lesson: Lesson }
  | { type: "lesson-view"; lesson: Lesson };

export default function CourseManagement({ onBack }: CourseManagementProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessonsByChapter, setLessonsByChapter] = useState<Record<number, Lesson[]>>({});
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<Modal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load subjects
  useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json() as Promise<{ subjects: Subject[] }>)
      .then(({ subjects }) => {
        setSubjects(subjects);
        if (subjects.length) setActiveSubjectId(subjects[0].id);
      })
      .catch(() => setError("加载学科失败"))
      .finally(() => setLoading(false));
  }, []);

  // Load chapters when subject changes
  const loadChapters = useCallback(
    (subjectId: number) => {
      fetch(`/api/subjects/${subjectId}/chapters`)
        .then((r) => r.json() as Promise<{ chapters: Chapter[] }>)
        .then(({ chapters }) => setChapters(chapters))
        .catch(() => setError("加载章节失败"));
    },
    [],
  );

  useEffect(() => {
    if (activeSubjectId) {
      setChapters([]);
      setLessonsByChapter({});
      setExpandedChapters(new Set());
      loadChapters(activeSubjectId);
    }
  }, [activeSubjectId, loadChapters]);

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

  const handleDeleteChapter = async (chapterId: number, title: string) => {
    if (!confirm(`确认删除章节「${title}」及其下所有课时吗？`)) return;
    await fetch(`/api/chapters/${chapterId}`, { method: "DELETE" });
    if (activeSubjectId) loadChapters(activeSubjectId);
  };

  const handleDeleteLesson = async (lessonId: number, chapterId: number, title: string) => {
    if (!confirm(`确认删除课时「${title}」吗？`)) return;
    await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    setLessonsByChapter((prev) => ({
      ...prev,
      [chapterId]: (prev[chapterId] ?? []).filter((l) => l.id !== lessonId),
    }));
  };

  const handleToggleLessonStatus = async (lesson: Lesson, chapterId: number) => {
    const newStatus = lesson.status === "active" ? "inactive" : "active";
    await fetch(`/api/lessons/${lesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLessonsByChapter((prev) => ({
      ...prev,
      [chapterId]: (prev[chapterId] ?? []).map((l) =>
        l.id === lesson.id ? { ...l, status: newStatus } : l,
      ),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeSubject = subjects.find((s) => s.id === activeSubjectId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← 返回
        </button>
        <h2 className="text-xl font-bold text-gray-900">课程管理</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Subject tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSubjectId(s.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeSubjectId === s.id
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Chapter list */}
      {activeSubjectId && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-500">
              {activeSubject?.name} · 章节列表
            </h3>
            <button
              onClick={() => setModal({ type: "chapter-create", subjectId: activeSubjectId })}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              + 新建章节
            </button>
          </div>

          {chapters.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">暂无章节，点击上方按钮新建</p>
          )}

          {chapters.map((ch) => (
            <div key={ch.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Chapter header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleChapter(ch.id)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  {expandedChapters.has(ch.id) ? "▼" : "▶"}
                </button>
                <span className="font-medium text-gray-800 flex-1">{ch.title}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal({ type: "lesson-create", chapterId: ch.id, chapterTitle: ch.title })}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    + 新建课时
                  </button>
                  <button
                    onClick={() => setModal({ type: "chapter-edit", chapter: ch })}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDeleteChapter(ch.id, ch.title)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              </div>

              {/* Lessons */}
              {expandedChapters.has(ch.id) && (
                <div className="border-t border-gray-100">
                  {(lessonsByChapter[ch.id] ?? []).length === 0 ? (
                    <p className="text-gray-400 text-xs text-center py-4">暂无课时</p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {(lessonsByChapter[ch.id] ?? []).map((lesson) => (
                        <li
                          key={lesson.id}
                          className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50"
                        >
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              lesson.status === "active" ? "bg-green-400" : "bg-gray-300"
                            }`}
                          />
                          <button
                            onClick={() => setModal({ type: "lesson-view", lesson })}
                            className="flex-1 text-left text-sm text-gray-700 hover:text-indigo-600 truncate"
                          >
                            {lesson.title}
                          </button>
                          {lesson.tags && (
                            <span className="text-xs text-gray-400 hidden sm:block">{lesson.tags}</span>
                          )}
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleToggleLessonStatus(lesson, ch.id)}
                              className={`text-xs ${
                                lesson.status === "active"
                                  ? "text-yellow-500 hover:text-yellow-700"
                                  : "text-green-500 hover:text-green-700"
                              }`}
                            >
                              {lesson.status === "active" ? "停用" : "启用"}
                            </button>
                            <button
                              onClick={() => setModal({ type: "lesson-edit", lesson })}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(lesson.id, ch.id, lesson.title)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              删除
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.type === "chapter-create" && (
        <ChapterFormModal
          subjectId={modal.subjectId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            if (activeSubjectId) loadChapters(activeSubjectId);
          }}
        />
      )}
      {modal?.type === "chapter-edit" && (
        <ChapterFormModal
          subjectId={0}
          chapter={modal.chapter}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            if (activeSubjectId) loadChapters(activeSubjectId);
          }}
        />
      )}
      {modal?.type === "lesson-create" && (
        <LessonFormModal
          chapterId={modal.chapterId}
          chapterTitle={modal.chapterTitle}
          onClose={() => setModal(null)}
          onSaved={(lesson) => {
            setModal(null);
            setLessonsByChapter((prev) => ({
              ...prev,
              [modal.chapterId]: [...(prev[modal.chapterId] ?? []), lesson],
            }));
          }}
        />
      )}
      {modal?.type === "lesson-edit" && (
        <LessonFormModal
          chapterId={modal.lesson.chapter_id}
          chapterTitle=""
          lesson={modal.lesson}
          onClose={() => setModal(null)}
          onSaved={(updated) => {
            setModal(null);
            setLessonsByChapter((prev) => ({
              ...prev,
              [modal.lesson.chapter_id]: (prev[modal.lesson.chapter_id] ?? []).map((l) =>
                l.id === updated.id ? { ...l, ...updated } : l,
              ),
            }));
          }}
        />
      )}
      {modal?.type === "lesson-view" && (
        <LessonViewModal lesson={modal.lesson} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ── Chapter Form Modal ─────────────────────────────────────────────────────────

function ChapterFormModal({
  subjectId,
  chapter,
  onClose,
  onSaved,
}: {
  subjectId: number;
  chapter?: Chapter;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [sortOrder, setSortOrder] = useState(chapter?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = chapter ? `/api/chapters/${chapter.id}` : `/api/subjects/${subjectId}/chapters`;
      const method = chapter ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sort_order: sortOrder }),
      });
      if (!r.ok) {
        const data = (await r.json()) as { error?: string };
        setError(data.error ?? "保存失败");
        return;
      }
      onSaved();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper title={chapter ? "编辑章节" : "新建章节"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">章节名称</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="请输入章节名称"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">排序序号</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ── Lesson Form Modal ──────────────────────────────────────────────────────────

function LessonFormModal({
  chapterId,
  chapterTitle,
  lesson,
  onClose,
  onSaved,
}: {
  chapterId: number;
  chapterTitle: string;
  lesson?: Lesson;
  onClose: () => void;
  onSaved: (lesson: Lesson) => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [content, setContent] = useState(lesson?.content ?? "");
  const [tags, setTags] = useState(lesson?.tags ?? "");
  const [sortOrder, setSortOrder] = useState(lesson?.sort_order ?? 0);
  const [status, setStatus] = useState<"active" | "inactive">(lesson?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = lesson ? `/api/lessons/${lesson.id}` : `/api/chapters/${chapterId}/lessons`;
      const method = lesson ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: content || null, tags: tags || null, sort_order: sortOrder, status }),
      });
      if (!r.ok) {
        const data = (await r.json()) as { error?: string };
        setError(data.error ?? "保存失败");
        return;
      }
      const data = (await r.json()) as { lesson?: Lesson; error?: string };
      if (!r.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      if (!data.lesson) {
        setError("保存成功，但未能获取最新课时数据，请刷新页面");
        return;
      }
      onSaved(data.lesson);
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper
      title={lesson ? "编辑课时" : `新建课时 · ${chapterTitle}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">课时标题</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="请输入课时标题"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">课时内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-y"
            placeholder="支持 Markdown 格式..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标签（逗号分隔）</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="如：第一单元,识字"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">排序序号</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="status-toggle"
            type="checkbox"
            checked={status === "active"}
            onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
            className="rounded border-gray-300 text-indigo-600"
          />
          <label htmlFor="status-toggle" className="text-sm text-gray-700">
            发布（学生可见）
          </label>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ── Lesson View Modal ──────────────────────────────────────────────────────────

function LessonViewModal({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  return (
    <ModalWrapper title={lesson.title} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex gap-2 text-xs text-gray-400">
          {lesson.tags && (
            <span className="bg-gray-100 px-2 py-0.5 rounded">{lesson.tags}</span>
          )}
          <span
            className={`px-2 py-0.5 rounded ${
              lesson.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {lesson.status === "active" ? "已发布" : "已停用"}
          </span>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap min-h-24 max-h-96 overflow-y-auto">
          {lesson.content ?? "（暂无内容）"}
        </div>
      </div>
    </ModalWrapper>
  );
}

// ── Shared Modal Wrapper ───────────────────────────────────────────────────────

function ModalWrapper({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
