"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { marked } from "marked";
import { toast } from "sonner";
import { apiFetch } from "@/lib/admin-api";
import { revalidate } from "@/lib/revalidate";
import { PageHeader } from "@/components/admin/PageHeader";
import { SaveButton } from "@/components/admin/SaveButton";

interface BlogPost {
  id: string; slug: string; title: string; excerpt: string; content: string;
  tags: string[]; published: boolean; publishedAt: string | null;
  readingTime: number; views: number; createdAt: string;
  canonicalUrl: string | null; kbDocumentId: string | null;
}
interface BlogList { data: BlogPost[]; total: number; page: number; limit: number; }

type EditorMode = "list" | "create" | "edit";

const EMPTY_FORM = { title: "", excerpt: "", content: "", tags: "", canonicalUrl: "", slug: "" };

marked.setOptions({ breaks: true });

export default function BlogAdminPage() {
  const [list, setList]             = useState<BlogList | null>(null);
  const [loading, setLoading]       = useState(true);
  const [mode, setMode]             = useState<EditorMode>("list");
  const [editing, setEditing]       = useState<BlogPost | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [page, setPage]             = useState(1);
  const [preview, setPreview]       = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const autosaveKey = `blog-draft-${editing?.id ?? "new"}`;

  // Autosave to localStorage every 30s
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (mode === "list") return;
    autosaveRef.current = setInterval(() => {
      try { localStorage.setItem(autosaveKey, JSON.stringify(form)); } catch {}
    }, 30000);
    return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
  }, [mode, form, autosaveKey]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    if (mode === "list" || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [mode, isDirty]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<BlogList>(`/blog/admin/list?page=${page}&limit=20`);
      setList(data);
    } catch {
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    // Restore localStorage draft if any
    let restored = EMPTY_FORM;
    try {
      const saved = localStorage.getItem("blog-draft-new");
      if (saved) restored = { ...EMPTY_FORM, ...JSON.parse(saved) as typeof EMPTY_FORM };
    } catch {}
    setEditing(null);
    setForm(restored);
    setInitialForm(EMPTY_FORM);
    setPreview(false);
    setMode("create");
  }

  function openEdit(post: BlogPost) {
    const f = {
      title: post.title, excerpt: post.excerpt, content: post.content,
      tags: post.tags.join(", "), canonicalUrl: post.canonicalUrl ?? "", slug: post.slug,
    };
    setEditing(post);
    setForm(f);
    setInitialForm(f);
    setPreview(false);
    setMode("edit");
  }

  function handleBack() {
    if (isDirty && !confirm("You have unsaved changes. Leave without saving?")) return;
    setMode("list");
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      title: form.title.trim(), excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      ...(form.canonicalUrl.trim() && { canonicalUrl: form.canonicalUrl.trim() }),
      ...(mode === "create" && form.slug.trim() && { slug: form.slug.trim() }),
    };
    try {
      if (mode === "create") {
        await apiFetch("/blog", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Post created as draft");
        try { localStorage.removeItem("blog-draft-new"); } catch {}
      } else {
        await apiFetch(`/blog/${editing!.slug}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Post updated");
      }
      setInitialForm(form);
      setMode("list");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(post: BlogPost) {
    try {
      await apiFetch(`/blog/${post.slug}`, {
        method: "PATCH",
        body: JSON.stringify({ published: !post.published }),
      });
      void revalidate("blog");
      toast.success(post.published ? "Post unpublished" : "Post published — public site updating");
      void load();
    } catch {
      toast.error("Failed to toggle publish");
    }
  }

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Delete "${post.title}"? This also removes it from the KB.`)) return;
    try {
      await apiFetch(`/blog/${post.slug}`, { method: "DELETE" });
      toast.success("Post deleted");
      void load();
    } catch {
      toast.error("Delete failed");
    }
  }

  const totalPages = list ? Math.ceil(list.total / 20) : 1;

  // ── Editor ──────────────────────────────────────────────────────────────────
  if (mode === "create" || mode === "edit") {
    const previewHtml = marked.parse(form.content || "") as string;

    return (
      <div>
        <PageHeader
          index={mode === "create" ? "NEW POST" : "EDIT POST"}
          title={mode === "create" ? "New Blog Post" : (editing?.title ?? "Edit Post")}
        />
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleBack} className="font-mono text-mono-label text-text-lo hover:text-signal transition-colors">
            {isDirty ? "← Back (unsaved changes)" : "← Back to posts"}
          </button>
          <button
            onClick={() => setPreview(v => !v)}
            className={`font-mono text-mono-label uppercase tracking-widest px-4 py-1.5 rounded-btn border transition-colors ${preview ? "border-signal text-signal" : "border-ink-600 text-text-mid hover:border-signal hover:text-signal"}`}
          >
            {preview ? "← Edit" : "Preview"}
          </button>
        </div>

        {preview ? (
          /* ── Rendered preview ── */
          <div className="max-w-3xl">
            <div className="bg-ink-800 border border-ink-600 rounded-card p-8">
              <h1 className="font-display text-display-l text-text-hi mb-4">{form.title || "Untitled"}</h1>
              <p className="text-text-mid mb-8 italic">{form.excerpt}</p>
              <div
                className="prose prose-invert prose-sm max-w-none text-text-hi prose-headings:font-display prose-headings:text-text-hi prose-code:text-signal prose-code:bg-ink-900 prose-code:rounded prose-code:px-1 prose-a:text-signal"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        ) : (
          /* ── Edit form ── */
          <div className="space-y-4 max-w-3xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Title" required>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="How I Built a RAG Chatbot..."
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-4 py-2.5 text-text-hi text-sm focus:border-signal outline-none transition-colors" />
              </Field>
              <div>
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1.5">
                  Slug {mode === "edit" && <span className="normal-case tracking-normal text-[10px] text-text-lo ml-1">(locked — changing breaks existing URLs)</span>}
                </label>
                <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="my-post-slug" disabled={mode === "edit"}
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-4 py-2.5 text-text-hi text-sm focus:border-signal outline-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed" />
              </div>
            </div>

            <Field label="Excerpt (shown in list)" required>
              <textarea value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                rows={2} placeholder="One-paragraph summary..."
                className="w-full bg-ink-900 border border-ink-600 rounded-btn px-4 py-2.5 text-text-hi text-sm focus:border-signal outline-none transition-colors resize-none" />
            </Field>

            <Field label="Content (Markdown)" required>
              <div className="relative">
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={22} placeholder={"## Introduction\n\nWrite your post here in markdown..."}
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-4 py-2.5 text-text-hi font-mono text-xs focus:border-signal outline-none transition-colors resize-y" />
                <span className="absolute bottom-3 right-3 font-mono text-[10px] text-text-lo pointer-events-none">
                  {form.content.split(" ").filter(Boolean).length} words
                </span>
              </div>
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tags (comma-separated)">
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="system-design, nestjs, ai"
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-4 py-2.5 text-text-hi text-sm focus:border-signal outline-none transition-colors" />
              </Field>
              <Field label="Canonical URL (if crossposted)">
                <input value={form.canonicalUrl} onChange={e => setForm(f => ({ ...f, canonicalUrl: e.target.value }))}
                  placeholder="https://linkedin.com/pulse/..."
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-4 py-2.5 text-text-hi text-sm focus:border-signal outline-none transition-colors" />
              </Field>
            </div>

            <div className="flex gap-3 pt-2">
              <SaveButton loading={saving} onClick={() => void handleSave()} type="button" disabled={!form.title || !form.content}>
                {mode === "create" ? "Create Draft" : "Save Changes"}
              </SaveButton>
              <button onClick={handleBack}
                className="border border-ink-600 text-text-mid font-mono text-mono-label uppercase tracking-widest px-6 py-2 rounded-btn hover:border-text-lo transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader index="09 / BLOG" title="Blog Posts" />

      <div className="flex items-center justify-between mb-6">
        <p className="font-mono text-mono-label text-text-lo">{list?.total ?? 0} posts total</p>
        <button onClick={openCreate}
          className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest px-5 py-2.5 rounded-btn hover:bg-signal-dim active:scale-[.98] transition-all">
          + New Post
        </button>
      </div>

      {loading && <p className="font-mono text-mono-label text-text-lo text-center py-16">Loading…</p>}

      {!loading && list?.data.length === 0 && (
        <p className="font-mono text-mono-label text-text-lo text-center py-16">No posts yet. Write your first one.</p>
      )}

      {!loading && list && list.data.length > 0 && (
        <div className="space-y-2">
          {list.data.map(post => (
            <div key={post.id} className="bg-ink-800 border border-ink-600 rounded-card px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${post.published ? "bg-ok/10 text-ok border border-ok/30" : "bg-ink-700 text-text-lo border border-ink-600"}`}>
                    {post.published ? "Published" : "Draft"}
                  </span>
                  <span className="font-mono text-mono-label text-text-lo">{post.readingTime} min read</span>
                  <span className="font-mono text-mono-label text-text-lo">{post.views} views</span>
                </div>
                <p className="text-text-hi text-sm font-medium truncate">{post.title}</p>
                <p className="text-text-lo text-xs mt-0.5 truncate">{post.excerpt}</p>
                {post.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {post.tags.map(t => (
                      <span key={t} className="font-mono text-[10px] px-1.5 py-0.5 bg-ink-700 border border-ink-600 rounded text-text-lo">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => void togglePublish(post)}
                  className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border transition-colors ${post.published ? "border-warn/40 text-warn hover:bg-warn/10" : "border-signal/40 text-signal hover:bg-signal/10"}`}>
                  {post.published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => openEdit(post)}
                  className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-ink-600 text-text-mid hover:border-signal hover:text-signal transition-colors">
                  Edit
                </button>
                <button onClick={() => void handleDelete(post)}
                  className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-danger/30 text-danger hover:bg-danger/10 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="font-mono text-mono-label uppercase tracking-widest px-4 py-2 border border-ink-600 rounded-btn text-text-mid hover:border-signal hover:text-signal disabled:opacity-30 transition-colors">
            ← Prev
          </button>
          <span className="font-mono text-mono-label text-text-lo">Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="font-mono text-mono-label uppercase tracking-widest px-4 py-2 border border-ink-600 rounded-btn text-text-mid hover:border-signal hover:text-signal disabled:opacity-30 transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1.5">
        {label}{required && <span className="text-signal ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
