import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Chapter } from "../../types";

// ── Agent fetch helper ─────────────────────────────────────────────────────────

async function fetchChapterFromAgent(title: string): Promise<{ chapterContent: string; knowledgePoints: string }> {
  const r = await fetch("/api/agents/fetch-chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = (await r.json()) as { chapterContent?: string; knowledgePoints?: string; error?: string };
  if (!r.ok) throw new Error(data.error ?? "获取失败");
  return {
    chapterContent: data.chapterContent ?? "",
    knowledgePoints: data.knowledgePoints ?? "",
  };
}

// ── Simple Markdown Editor ─────────────────────────────────────────────────────

function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Render markdown as HTML using basic rules
  function renderMarkdown(md: string): string {
    // Wrap consecutive <li> items in <ul>/<ol> for valid HTML
    // Process unordered first (they use plain <li>), then ordered (<li data-ol>)
    function wrapLists(html: string): string {
      return html
        .replace(/(<li>.*?<\/li>(\n|$))+/g, (m) => `<ul>${m}</ul>`)
        .replace(/(<li data-ol>.*?<\/li>(\n|$))+/g, (m) => `<ol>${m.replace(/ data-ol/g, "")}</ol>`);
    }

    const html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // headings
      .replace(/^###### (.+)$/gm, "<h6>$1</h6>")
      .replace(/^##### (.+)$/gm, "<h5>$1</h5>")
      .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      // bold / italic
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // horizontal rule
      .replace(/^---$/gm, "<hr/>")
      // ordered list items (mark with data-ol to distinguish from unordered)
      .replace(/^\d+\. (.+)$/gm, "<li data-ol>$1</li>")
      // unordered list items
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      // blockquote
      .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

    return wrapLists(html)
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>");
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-gray-200 rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          type="button"
          onClick={() => setTab("edit")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "edit"
              ? "bg-white text-indigo-600 border-b-2 border-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "preview"
              ? "bg-white text-indigo-600 border-b-2 border-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          预览
        </button>
        <span className="ml-auto px-3 py-2 text-xs text-gray-400 self-center">
          支持 Markdown
        </span>
      </div>

      {/* Editor / Preview */}
      {tab === "edit" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="在此输入章节正文内容（支持 Markdown 格式）…"
          className="flex-1 w-full p-4 text-sm font-mono resize-none focus:outline-none bg-white text-gray-800 placeholder:text-gray-300"
          spellCheck={false}
        />
      ) : (
        <div
          className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: value.trim()
              ? `<p>${renderMarkdown(value)}</p>`
              : '<p class="text-gray-400 italic">（暂无内容）</p>',
          }}
        />
      )}
    </div>
  );
}

// ── Chapter Editor Panel (embeddable, no page header) ─────────────────────────

export function ChapterEditorPanel({
  courseId,
  chapterId,
  onCancel,
}: {
  courseId: number;
  chapterId?: string; // undefined = new chapter
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const isNew = chapterId === undefined;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [knowledgePoints, setKnowledgePoints] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");

  // Reset form when switching between chapters
  useEffect(() => {
    setTitle("");
    setContent("");
    setKnowledgePoints("");
    setError("");
    setSavedOk(false);
    if (isNew || !chapterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/chapters/${chapterId}`)
      .then(async (r) => {
        const data = (await r.json()) as { chapter?: Chapter; error?: string };
        if (!r.ok) { setError(data.error ?? "加载章节失败"); return; }
        if (data.chapter) {
          setTitle(data.chapter.title);
          setContent(data.chapter.content ?? "");
          setKnowledgePoints(data.chapter.knowledge_points ?? "");
        }
      })
      .catch(() => setError("加载章节失败"))
      .finally(() => setLoading(false));
  }, [chapterId, isNew]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("章节名称不能为空"); return; }
    setError("");
    setSavedOk(false);
    setSaving(true);
    try {
      let r: Response;
      if (isNew) {
        r = await fetch(`/api/courses/${courseId}/chapters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content: content || null, knowledge_points: knowledgePoints || null }),
        });
      } else {
        r = await fetch(`/api/chapters/${chapterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content: content || null, knowledge_points: knowledgePoints || null }),
        });
      }

      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setError(d.error ?? "保存失败");
        return;
      }

      if (isNew) {
        const { chapter } = (await r.json()) as { chapter: Chapter };
        navigate(`/admin/courses/${courseId}/chapters/${chapter.id}`, { replace: true });
      } else {
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2000);
      }
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const handleFetchFromWeb = async () => {
    if (!title.trim()) { setError("请先输入章节标题"); return; }
    setError("");
    setFetching(true);
    try {
      const result = await fetchChapterFromAgent(title.trim());
      if (result.chapterContent) setContent(result.chapterContent);
      if (result.knowledgePoints) setKnowledgePoints(result.knowledgePoints);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取内容失败");
    } finally {
      setFetching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          章节标题 <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入章节标题…"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            disabled={fetching || !title.trim()}
            onClick={handleFetchFromWeb}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            title="从互联网获取课文正文和知识点"
          >
            {fetching ? "获取中…" : "从互联网获取"}
          </button>
        </div>
      </div>

      {/* Content (Markdown) */}
      <div className="flex flex-col flex-1 min-h-0">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          章节正文
        </label>
        <MarkdownEditor value={content} onChange={setContent} />
      </div>

      {/* Knowledge Points */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          知识点
        </label>
        <textarea
          value={knowledgePoints}
          onChange={(e) => setKnowledgePoints(e.target.value)}
          placeholder="输入知识点（生字词、主题思想、写作特色等，支持 Markdown）…"
          rows={6}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* Status / Actions */}
      <div className="flex items-center justify-between shrink-0 pt-1">
        <div className="text-sm">
          {error && <span className="text-red-500">{error}</span>}
          {savedOk && <span className="text-emerald-600">✓ 已保存</span>}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </form>
  );
}
