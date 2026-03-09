import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Subject, Course, Chapter } from "../../types";

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CourseManagement() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

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

  const loadCourses = useCallback((subjectId: number) => {
    fetch(`/api/subjects/${subjectId}/courses`)
      .then(async (r) => {
        const data = (await r.json()) as { courses?: Course[]; error?: string };
        if (!r.ok) { setError(data.error ?? "加载课程失败"); return; }
        setError("");
        setCourses(data.courses ?? []);
        setSelectedCourseId(null);
        setChapters([]);
      })
      .catch(() => setError("加载课程失败"));
  }, []);

  useEffect(() => {
    if (activeSubjectId) loadCourses(activeSubjectId);
  }, [activeSubjectId, loadCourses]);

  const selectedCourseIdRef = useRef<number | null>(null);

  const loadChapters = useCallback((courseId: number) => {
    selectedCourseIdRef.current = courseId;
    setChaptersLoading(true);
    fetch(`/api/courses/${courseId}/chapters`)
      .then(async (r) => {
        const data = (await r.json()) as { chapters?: Chapter[]; error?: string };
        if (selectedCourseIdRef.current !== courseId) return;
        if (!r.ok) { setError(data.error ?? "加载章节失败"); return; }
        setError("");
        setChapters(data.chapters ?? []);
      })
      .catch(() => setError("加载章节失败"))
      .finally(() => {
        if (selectedCourseIdRef.current === courseId) setChaptersLoading(false);
      });
  }, []);

  const handleSelectCourse = (courseId: number) => {
    setSelectedCourseId(courseId);
    loadChapters(courseId);
    setShowMobileDetail(true);
  };

  const handleDeleteCourse = async (courseId: number, title: string) => {
    if (!confirm(`确认删除课程「${title}」及其下所有章节吗？`)) return;
    await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
    if (selectedCourseId === courseId) {
      setSelectedCourseId(null);
      setChapters([]);
    }
    if (activeSubjectId) loadCourses(activeSubjectId);
  };

  const handleDeleteChapter = async (chapterId: number, title: string) => {
    if (!confirm(`确认删除章节「${title}」吗？`)) return;
    await fetch(`/api/chapters/${chapterId}`, { method: "DELETE" });
    setChapters((prev) => prev.filter((c) => c.id !== chapterId));
  };

  const handleImportDone = () => {
    setShowImport(false);
    if (activeSubjectId) loadCourses(activeSubjectId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

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
        {/* ── Left Panel: Course List ── */}
        <aside className={`flex flex-col border-r border-gray-100 bg-gray-50/60 overflow-hidden md:w-72 md:shrink-0 md:flex ${showMobileDetail ? "hidden" : "flex-1 md:flex-none"}`}>
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
              <NewCourseInline
                subjectId={activeSubjectId}
                onSaved={() => loadCourses(activeSubjectId)}
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

          {/* Course list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {courses.length === 0 ? (
              <p className="text-gray-400 text-xs text-center py-8">暂无课程</p>
            ) : (
              <ul className="space-y-1">
                {courses.map((co) => (
                  <CourseItem
                    key={co.id}
                    course={co}
                    selected={selectedCourseId === co.id}
                    onSelect={() => handleSelectCourse(co.id)}
                    onUpdated={() => activeSubjectId && loadCourses(activeSubjectId)}
                    onDelete={() => handleDeleteCourse(co.id, co.title)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Right Panel: Chapter List ── */}
        <main className={`overflow-y-auto bg-white md:flex md:flex-col md:flex-1 ${showMobileDetail ? "flex flex-col flex-1" : "hidden"}`}>
          {/* Mobile back button */}
          <div className="md:hidden flex items-center px-4 py-2 border-b border-gray-100 shrink-0">
            <button
              onClick={() => setShowMobileDetail(false)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← 课程列表
            </button>
          </div>
          {!selectedCourse ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-4xl mb-3">📖</div>
              <p className="text-sm">从左侧选择课程查看章节</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Course header */}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">{selectedCourse.title}</h3>
                <span className="text-xs text-gray-400">{chapters.length} 个章节</span>
              </div>

              {/* Add chapter inline form */}
              <NewChapterInline
                courseId={selectedCourse.id}
                onSaved={(chapter) => setChapters((prev) => [...prev, chapter])}
              />

              {/* Chapter list */}
              {chaptersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : chapters.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">暂无章节，点击上方「+ 新建章节」添加</p>
              ) : (
                <ul className="space-y-2">
                  {chapters.map((ch) => (
                    <ChapterRow
                      key={ch.id}
                      chapter={ch}
                      onUpdated={() => selectedCourse && loadChapters(selectedCourse.id)}
                      onDelete={() => handleDeleteChapter(ch.id, ch.title)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Course List Item (with inline editing) ────────────────────────────────────

function CourseItem({
  course,
  selected,
  onSelect,
  onUpdated,
  onDelete,
}: {
  course: Course;
  selected: boolean;
  onSelect: () => void;
  onUpdated: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(course.title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTitle(course.title);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!title.trim() || title.trim() === course.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await fetch(`/api/courses/${course.id}`, {
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
          <span className="flex-1 truncate font-medium">{course.title}</span>
          <span
            className={`flex gap-1 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 ${selected ? "md:opacity-100" : ""}`}
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

// ── New Course Inline Form ─────────────────────────────────────────────────────

function NewCourseInline({
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

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await fetch(`/api/subjects/${subjectId}/courses`, {
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
        onClick={() => setOpen(true)}
        className="flex-1 text-xs py-1.5 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium"
      >
        + 新建课程
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
        placeholder="课程名称（如：四年级(上)）"
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
      const data = (await r.json()) as { ok?: boolean; created?: { courses: number; chapters: number }; error?: string };
      if (r.ok && data.ok) {
        setResult(`✅ 导入成功：${data.created?.courses ?? 0} 个课程，${data.created?.chapters ?? 0} 个章节`);
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
      <p className="text-xs font-semibold text-amber-800">导入课程与章节</p>
      <p className="text-xs text-amber-700 leading-relaxed">
        粘贴 JSON 数组，格式：
        <code className="block mt-1 bg-amber-100 rounded p-1 font-mono text-[10px] whitespace-pre">
{`[{"title":"四年级(上)","chapters":[
  {"title":"第一单元"},
  {"title":"第二单元"}
]}]`}
        </code>
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={5}
        className="w-full text-xs font-mono px-2 py-1.5 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y"
        placeholder='[{"title": "四年级(上)", "chapters": [...]}]'
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

// ── New Chapter Inline Form ────────────────────────────────────────────────────

function NewChapterInline({
  courseId,
  onSaved,
}: {
  courseId: number;
  onSaved: (chapter: Chapter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    setSaving(true);
    try {
      const r = await fetch(`/api/courses/${courseId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setError(d.error ?? "保存失败");
        return;
      }
      const { chapter } = (await r.json()) as { chapter: Chapter };
      onSaved(chapter);
      setTitle("");
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
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
      >
        <span className="text-base leading-none">+</span> 新建章节
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-indigo-800">新建章节</span>
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
        placeholder="章节名称 *"
        className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
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

// ── Chapter Row (with inline editing) ─────────────────────────────────────────

function ChapterRow({
  chapter,
  onUpdated,
  onDelete,
}: {
  chapter: Chapter;
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
    if (e.key === "Escape") { setEditing(false); setTitle(chapter.title); }
  };

  if (editing) {
    return (
      <li className="flex items-center gap-2 bg-white border-2 border-indigo-300 rounded-xl px-4 py-3 shadow-sm">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm outline-none bg-transparent"
        />
        <button
          onClick={saveEdit}
          disabled={saving}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
        >
          保存
        </button>
        <button
          onClick={() => { setEditing(false); setTitle(chapter.title); }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
      <span className="flex-1 text-sm text-gray-800">{chapter.title}</span>
      <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { setTitle(chapter.title); setEditing(true); }}
          className="text-xs text-gray-400 hover:text-indigo-600 px-2 py-0.5 rounded"
        >
          编辑
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-gray-400 hover:text-red-500 px-2 py-0.5 rounded"
        >
          删除
        </button>
      </div>
    </li>
  );
}
