import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Subject, Chapter, Lesson } from "../../types";

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CourseManagement() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);

  // Load subjects
  useEffect(() => {
    fetch("/api/subjects")
      .then(async (r) => {
        const data = (await r.json()) as { subjects?: Subject[]; error?: string };
        if (!r.ok) { setError(data.error ?? "加载学科失败"); return; }
        const subjects = data.subjects ?? [];
        setSubjects(subjects);
        if (subjects.length) setActiveSubjectId(subjects[0].id);
      })
      .catch(() => setError("加载学科失败"))
      .finally(() => setLoading(false));
  }, []);

  const loadChapters = useCallback((subjectId: number) => {
    fetch(`/api/subjects/${subjectId}/chapters`)
      .then(async (r) => {
        const data = (await r.json()) as { chapters?: Chapter[]; error?: string };
        if (!r.ok) { setError(data.error ?? "加载章节失败"); return; }
        setError("");
        setChapters(data.chapters ?? []);
        setSelectedChapterId(null);
        setLessons([]);
      })
      .catch(() => setError("加载章节失败"));
  }, []);

  useEffect(() => {
    if (activeSubjectId) loadChapters(activeSubjectId);
  }, [activeSubjectId, loadChapters]);

  const selectedChapterIdRef = useRef<number | null>(null);

  const loadLessons = useCallback((chapterId: number) => {
    selectedChapterIdRef.current = chapterId;
    setLessonsLoading(true);
    fetch(`/api/chapters/${chapterId}/lessons`)
      .then(async (r) => {
        const data = (await r.json()) as { lessons?: Lesson[]; error?: string };
        // Discard stale responses from previously selected chapters
        if (selectedChapterIdRef.current !== chapterId) return;
        if (!r.ok) { setError(data.error ?? "加载课时失败"); return; }
        setError("");
        setLessons(data.lessons ?? []);
      })
      .catch(() => setError("加载课时失败"))
      .finally(() => {
        if (selectedChapterIdRef.current === chapterId) setLessonsLoading(false);
      });
  }, []);

  const handleSelectChapter = (chapterId: number) => {
    setSelectedChapterId(chapterId);
    loadLessons(chapterId);
  };

  const handleDeleteChapter = async (chapterId: number, title: string) => {
    if (!confirm(`确认删除章节「${title}」及其下所有课时吗？`)) return;
    await fetch(`/api/chapters/${chapterId}`, { method: "DELETE" });
    if (selectedChapterId === chapterId) {
      setSelectedChapterId(null);
      setLessons([]);
    }
    if (activeSubjectId) loadChapters(activeSubjectId);
  };

  const handleDeleteLesson = async (lessonId: number, title: string) => {
    if (!confirm(`确认删除课时「${title}」吗？`)) return;
    await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    setLessons((prev) => prev.filter((l) => l.id !== lessonId));
  };

  const handleToggleLessonStatus = async (lesson: Lesson) => {
    const newStatus = lesson.status === "active" ? "inactive" : "active";
    await fetch(`/api/lessons/${lesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, status: newStatus } : l)));
  };

  const handleImportDone = () => {
    setShowImport(false);
    if (activeSubjectId) loadChapters(activeSubjectId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
        >
          ← 返回
        </button>
        <h2 className="text-lg font-bold text-gray-900">课程管理</h2>
        {error && (
          <span className="ml-auto text-sm text-red-500">{error}</span>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left Panel: Chapter List ── */}
        <aside className="w-72 shrink-0 flex flex-col border-r border-gray-100 bg-gray-50/60 overflow-hidden">
          {/* Subject selector */}
          <div className="flex gap-1 px-3 pt-3 pb-2 shrink-0 flex-wrap">
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSubjectId(s.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeSubjectId === s.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 px-3 pb-2 shrink-0">
            {activeSubjectId && (
              <NewChapterInline
                subjectId={activeSubjectId}
                onSaved={() => loadChapters(activeSubjectId)}
              />
            )}
            <button
              onClick={() => setShowImport((v) => !v)}
              className={`flex-1 text-xs py-1.5 px-3 rounded-lg border transition-colors ${
                showImport
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              ↑ 导入
            </button>
          </div>

          {/* Import panel */}
          {showImport && activeSubjectId && (
            <div className="mx-3 mb-2 shrink-0">
              <ImportPanel subjectId={activeSubjectId} onDone={handleImportDone} />
            </div>
          )}

          {/* Chapter list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {chapters.length === 0 ? (
              <p className="text-gray-400 text-xs text-center py-8">暂无章节</p>
            ) : (
              <ul className="space-y-1">
                {chapters.map((ch) => (
                  <ChapterItem
                    key={ch.id}
                    chapter={ch}
                    selected={selectedChapterId === ch.id}
                    onSelect={() => handleSelectChapter(ch.id)}
                    onUpdated={() => activeSubjectId && loadChapters(activeSubjectId)}
                    onDelete={() => handleDeleteChapter(ch.id, ch.title)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Right Panel: Lesson Cards ── */}
        <main className="flex-1 overflow-y-auto bg-white">
          {!selectedChapter ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-4xl mb-3">📖</div>
              <p className="text-sm">从左侧选择章节查看课时</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Chapter header */}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">{selectedChapter.title}</h3>
                <span className="text-xs text-gray-400">{lessons.length} 个课时</span>
              </div>

              {/* Add lesson inline form */}
              <NewLessonInline
                chapterId={selectedChapter.id}
                onSaved={(lesson) => setLessons((prev) => [...prev, lesson])}
              />

              {/* Lesson cards */}
              {lessonsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : lessons.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">暂无课时，点击上方「+ 新建课时」添加</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {lessons.map((lesson) => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onSaved={(updated) =>
                        setLessons((prev) =>
                          prev.map((l) => (l.id === updated.id ? updated : l)),
                        )
                      }
                      onToggleStatus={() => handleToggleLessonStatus(lesson)}
                      onDelete={() => handleDeleteLesson(lesson.id, lesson.title)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Chapter List Item (with inline editing) ───────────────────────────────────

function ChapterItem({
  chapter,
  selected,
  onSelect,
  onUpdated,
  onDelete,
}: {
  chapter: Chapter;
  selected: boolean;
  onSelect: () => void;
  onUpdated: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chapter.title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTitle(chapter.title);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!title.trim() || title.trim() === chapter.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await fetch(`/api/chapters/${chapter.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setSaving(false);
    setEditing(false);
    onUpdated();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditing(false);
  };

  return (
    <li>
      {editing ? (
        <div className="flex items-center gap-1 p-1.5 rounded-lg bg-white border border-indigo-200 shadow-sm">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm px-2 py-0.5 outline-none bg-transparent"
          />
          <button
            onClick={saveEdit}
            disabled={saving}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-1 disabled:opacity-50"
          >
            保存
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={onSelect}
          className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
            selected
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-700 hover:bg-white hover:shadow-sm"
          }`}
        >
          <span className="flex-1 truncate font-medium">{chapter.title}</span>
          <span
            className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${selected ? "opacity-100" : ""}`}
          >
            <button
              type="button"
              onClick={startEdit}
              className={`text-xs px-1 rounded hover:underline ${selected ? "text-indigo-200 hover:text-white" : "text-gray-400 hover:text-gray-700"}`}
            >
              编辑
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className={`text-xs px-1 rounded hover:underline ${selected ? "text-red-300 hover:text-white" : "text-red-400 hover:text-red-600"}`}
            >
              删除
            </button>
          </span>
        </button>
      )}
    </li>
  );
}

// ── New Chapter Inline Form ───────────────────────────────────────────────────

function NewChapterInline({
  subjectId,
  onSaved,
}: {
  subjectId: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await fetch(`/api/subjects/${subjectId}/chapters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setSaving(false);
    setTitle("");
    setOpen(false);
    onSaved();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setOpen(false); setTitle(""); }
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex-1 text-xs py-1.5 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
      >
        + 新建章节
      </button>
    );
  }

  return (
    <div className="flex-1 flex items-center gap-1 bg-white border border-indigo-200 rounded-lg px-2 py-1 shadow-sm">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="章节名称"
        className="flex-1 text-xs outline-none bg-transparent"
      />
      <button
        onClick={handleSave}
        disabled={saving || !title.trim()}
        className="text-xs text-indigo-600 font-medium disabled:opacity-40"
      >
        确定
      </button>
      <button
        onClick={() => { setOpen(false); setTitle(""); }}
        className="text-xs text-gray-400"
      >
        ✕
      </button>
    </div>
  );
}

// ── Import Panel ──────────────────────────────────────────────────────────────

function ImportPanel({ subjectId, onDone }: { subjectId: number; onDone: () => void }) {
  const [json, setJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>("");

  const handleImport = async () => {
    setResult("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setResult("❌ JSON 格式错误，请检查输入");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/subjects/${subjectId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await r.json()) as { ok?: boolean; created?: { chapters: number; lessons: number }; error?: string };
      if (r.ok && data.ok) {
        setResult(`✅ 导入成功：${data.created?.chapters ?? 0} 个章节，${data.created?.lessons ?? 0} 个课时`);
        setJson("");
        setTimeout(onDone, 1500);
      } else {
        setResult(`❌ ${data.error ?? "导入失败"}`);
      }
    } catch {
      setResult("❌ 网络错误");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-amber-800">导入章节与课时</p>
      <p className="text-xs text-amber-700 leading-relaxed">
        粘贴 JSON 数组，格式：
        <code className="block mt-1 bg-amber-100 rounded p-1 font-mono text-[10px] whitespace-pre">
{`[{"title":"章节名","lessons":[
  {"title":"课时名","content":"内容","tags":"标签"}
]}]`}
        </code>
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={5}
        className="w-full text-xs font-mono px-2 py-1.5 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y"
        placeholder='[{"title": "第一章", "lessons": [...]}]'
      />
      {result && (
        <p className="text-xs text-amber-900">{result}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          disabled={saving || !json.trim()}
          className="flex-1 text-xs py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? "导入中..." : "确认导入"}
        </button>
      </div>
    </div>
  );
}

// ── New Lesson Inline Form ────────────────────────────────────────────────────

function NewLessonInline({
  chapterId,
  onSaved,
}: {
  chapterId: number;
  onSaved: (lesson: Lesson) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    setSaving(true);
    try {
      const r = await fetch(`/api/chapters/${chapterId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content || null, tags: tags || null, status }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setError(d.error ?? "保存失败");
        return;
      }
      const { lesson } = (await r.json()) as { lesson: Lesson };
      onSaved(lesson);
      setTitle("");
      setContent("");
      setTags("");
      setStatus("active");
      setOpen(false);
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
      >
        <span className="text-base leading-none">+</span> 新建课时
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-indigo-800">新建课时</span>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="text-indigo-400 hover:text-indigo-600 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <input
        ref={titleRef}
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="课时标题 *"
        className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder="课时内容（支持 Markdown）"
        className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono resize-y"
      />
      <div className="flex gap-3">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="标签（逗号分隔）"
          className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <label className="flex items-center gap-1.5 text-sm text-indigo-700 cursor-pointer">
          <input
            type="checkbox"
            checked={status === "active"}
            onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
            className="rounded border-indigo-300 text-indigo-600"
          />
          发布
        </label>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

// ── Lesson Card (with inline editing) ────────────────────────────────────────

function LessonCard({
  lesson,
  onSaved,
  onToggleStatus,
  onDelete,
}: {
  lesson: Lesson;
  onSaved: (lesson: Lesson) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content ?? "");
  const [tags, setTags] = useState(lesson.tags ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(lesson.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const startEdit = () => {
    setTitle(lesson.title);
    setContent(lesson.content ?? "");
    setTags(lesson.tags ?? "");
    setStatus(lesson.status);
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    setSaving(true);
    try {
      const r = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content || null, tags: tags || null, status }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setError(d.error ?? "保存失败");
        return;
      }
      const { lesson: updated } = (await r.json()) as { lesson: Lesson };
      onSaved(updated);
      setEditing(false);
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="bg-white border-2 border-indigo-300 rounded-xl p-4 space-y-3 shadow-sm"
      >
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="课时标题 *"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="课时内容（支持 Markdown）"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono resize-y"
        />
        <div className="flex gap-3">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="标签（逗号分隔）"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={status === "active"}
              onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
              className="rounded border-gray-300 text-indigo-600"
            />
            发布
          </label>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="group bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Card header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-2 mb-2">
          <span
            className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
              lesson.status === "active" ? "bg-emerald-400" : "bg-gray-300"
            }`}
          />
          <h4 className="text-sm font-semibold text-gray-900 leading-snug flex-1">{lesson.title}</h4>
        </div>
        {lesson.tags && (
          <div className="flex flex-wrap gap-1 ml-4 mb-2">
            {lesson.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
              <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
        {lesson.content && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-4 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            {expanded ? "收起内容 ▲" : "查看内容 ▼"}
          </button>
        )}
        {expanded && lesson.content && (
          <div className="ml-4 mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
            {lesson.content}
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50/80 border-t border-gray-100">
        <span
          className={`text-xs font-medium ${
            lesson.status === "active" ? "text-emerald-600" : "text-gray-400"
          }`}
        >
          {lesson.status === "active" ? "已发布" : "已停用"}
        </span>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button
            onClick={onToggleStatus}
            className={`text-xs transition-colors ${
              lesson.status === "active"
                ? "text-amber-500 hover:text-amber-700"
                : "text-emerald-500 hover:text-emerald-700"
            }`}
          >
            {lesson.status === "active" ? "停用" : "启用"}
          </button>
          <button
            onClick={startEdit}
            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
