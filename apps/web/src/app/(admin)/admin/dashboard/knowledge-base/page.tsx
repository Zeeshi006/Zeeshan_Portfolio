"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { apiFetch } from "@/lib/admin-api";
import { PageHeader } from "@/components/admin/PageHeader";
import { SaveButton } from "@/components/admin/SaveButton";

interface KbDocument {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface KbAnalyticsItem {
  docId: string;
  title: string;
  citationCount: number;
}

interface ChatTestResult {
  answer: string;
  sources: { id: string; title: string }[];
}

type FormData = { title: string; content: string; metadata: string; published: boolean };

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KbDocument[]>([]);
  const [editing, setEditing] = useState<KbDocument | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<KbAnalyticsItem[] | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Test chatbot
  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<ChatTestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number; failed: number } | null>(null);

  async function syncToElevenLabs() {
    if (!confirm("This will overwrite the ElevenLabs knowledge base with all published documents. Continue?")) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiFetch<{ synced: number; skipped: number; failed: number }>("/chat/kb/sync-elevenlabs", { method: "POST" });
      setSyncResult(result);
      toast.success(`ElevenLabs sync complete — ${result.synced} synced`);
    } catch {
      setSyncResult({ synced: 0, skipped: 0, failed: -1 });
      toast.error("ElevenLabs sync failed — check API key in .env");
    } finally {
      setSyncing(false);
    }
  }

  const { register, handleSubmit, reset, setValue } = useForm<FormData>();

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<KbDocument[]>("/chat/kb");
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const data = await apiFetch<KbAnalyticsItem[]>("/chat/kb/analytics");
      setAnalytics(data);
    } catch {
      setAnalytics([]);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const [metadataError, setMetadataError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    reset({ title: "", content: "", metadata: "", published: false });
    setMetadataError(null);
    setShowForm(true);
  }

  function openEdit(doc: KbDocument) {
    setEditing(doc);
    setValue("title", doc.title);
    setValue("content", doc.content);
    setValue("metadata", doc.metadata && Object.keys(doc.metadata).length > 0 ? JSON.stringify(doc.metadata, null, 2) : "");
    setValue("published", doc.published);
    setMetadataError(null);
    setShowForm(true);
  }

  async function onSubmit(data: FormData) {
    let metadata: Record<string, unknown> = {};
    if (data.metadata.trim()) {
      try {
        metadata = JSON.parse(data.metadata) as Record<string, unknown>;
      } catch {
        setMetadataError("Invalid JSON — fix it or clear the field");
        return;
      }
    }
    setMetadataError(null);
    setSubmitting(true);
    try {
      const payload = { title: data.title, content: data.content, metadata, published: data.published };
      if (editing) {
        await apiFetch(`/chat/kb/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Document updated");
      } else {
        await apiFetch("/chat/kb", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Document created and queued for embedding");
      }
      setShowForm(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this KB document? This cannot be undone.")) return;
    try {
      await apiFetch(`/chat/kb/${id}`, { method: "DELETE" });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  async function handleToggleStatus(doc: KbDocument) {
    try {
      await apiFetch(`/chat/kb/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ published: !doc.published }),
      });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function runTest() {
    if (!testQuery.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const data = await apiFetch<ChatTestResult>("/chat/test", {
        method: "POST",
        body: JSON.stringify({ query: testQuery }),
      });
      setTestResult(data);
    } catch (err) {
      setTestResult({ answer: `Error: ${err instanceof Error ? err.message : "Unknown"}`, sources: [] });
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        index="05 / KNOWLEDGE BASE"
        title="Knowledge Base"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => void syncToElevenLabs()}
              disabled={syncing}
              className="border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-2.5 hover:border-signal hover:text-signal active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {syncing ? "Syncing…" : "Sync to ElevenLabs"}
            </button>
            <button
              onClick={() => { setShowTest(v => !v); }}
              className="border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-2.5 hover:border-signal hover:text-signal active:scale-[0.98] transition-all"
            >
              Test Bot
            </button>
            <button
              onClick={() => { setShowAnalytics(v => !v); if (!analytics) void loadAnalytics(); }}
              className="border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-2.5 hover:border-signal hover:text-signal active:scale-[0.98] transition-all"
            >
              Analytics
            </button>
            <button
              onClick={openCreate}
              className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2.5 hover:bg-signal-dim active:scale-[0.98] transition-all"
            >
              + Add Document
            </button>
          </div>
        }
      />

      {syncResult && (
        <div className={`mb-6 border rounded-card px-4 py-3 font-mono text-mono-label ${syncResult.failed === -1 ? "bg-danger/10 border-danger/30 text-danger" : "bg-ok/10 border-ok/30 text-ok"}`}>
          {syncResult.failed === -1
            ? "ElevenLabs sync failed — check API key and agent ID in .env"
            : `ElevenLabs sync complete — ${syncResult.synced} synced, ${syncResult.skipped} already synced, ${syncResult.failed} failed`
          }
        </div>
      )}

      {error && (
        <div className="mb-6 bg-danger/10 border border-danger/30 rounded-card px-4 py-3 font-mono text-mono-label text-danger">
          {error}
        </div>
      )}

      {/* ── Test chatbot panel ────────────────────────────────────────────────── */}
      {showTest && (
        <div className="mb-8 bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
            Test Chatbot (bypasses rate limits)
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void runTest(); }}
              placeholder="Ask a question to test the KB…"
              className="flex-1 bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi placeholder:text-text-lo focus:outline-none focus:border-signal transition-colors font-mono text-sm"
            />
            <button
              onClick={() => void runTest()}
              disabled={testLoading || !testQuery.trim()}
              className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-2 hover:bg-signal-dim active:scale-[0.98] disabled:opacity-40 transition-all"
            >
              {testLoading ? "…" : "Ask"}
            </button>
          </div>
          {testResult && (
            <div className="space-y-3">
              <div className="bg-ink-900 border border-ink-600 rounded-btn p-4">
                <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-2">Answer</p>
                <p className="text-text-hi text-sm leading-relaxed">{testResult.answer}</p>
              </div>
              {testResult.sources.length > 0 && (
                <div>
                  <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-2">Sources used</p>
                  <div className="flex flex-wrap gap-2">
                    {testResult.sources.map((s) => (
                      <span key={s.id} className="font-mono text-mono-label px-2 py-0.5 bg-ink-900 border border-ink-600 rounded text-text-mid">
                        📄 {s.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── KB Analytics panel ────────────────────────────────────────────────── */}
      {showAnalytics && (
        <div className="mb-8 bg-ink-800 border border-ink-600 rounded-card p-6 space-y-4">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest">
            Citation Analytics — Most Referenced Documents
          </h2>
          {analyticsLoading ? (
            <p className="font-mono text-mono-label text-text-lo">Loading…</p>
          ) : !analytics || analytics.length === 0 ? (
            <p className="font-mono text-mono-label text-text-lo">No citations recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {analytics.map((item, i) => {
                const maxCount = analytics[0]?.citationCount ?? 1;
                const pct = (item.citationCount / maxCount) * 100;
                return (
                  <div key={item.docId} className="flex items-center gap-4">
                    <span className="font-mono text-mono-label text-text-lo w-6 flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-text-hi text-sm truncate">{item.title}</span>
                        <span className="font-mono text-mono-label text-signal ml-2 flex-shrink-0">
                          {item.citationCount}×
                        </span>
                      </div>
                      <div className="h-1 bg-ink-900 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-signal/50"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit form ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className="mb-8 bg-ink-800 border border-ink-600 rounded-card p-6">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">
            {editing ? "Edit Document" : "New Document"}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Title</label>
              <input
                {...register("title", { required: true })}
                placeholder="e.g. Sales CRM Case Study"
                className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi placeholder:text-text-lo focus:outline-none focus:border-signal transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Content</label>
              <textarea
                {...register("content", { required: true })}
                rows={10}
                placeholder="Document content — this will be chunked and embedded for RAG queries..."
                className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi placeholder:text-text-lo focus:outline-none focus:border-signal transition-colors resize-y font-mono text-sm leading-relaxed"
              />
            </div>
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">
                Metadata <span className="normal-case tracking-normal text-text-lo/60">(optional JSON)</span>
              </label>
              <textarea
                {...register("metadata")}
                rows={4}
                placeholder={'{ "section": "experience", "company": "TapTap Technologies", "type": "role" }'}
                className={`w-full bg-ink-900 border rounded-btn px-3 py-2 text-text-hi placeholder:text-text-lo focus:outline-none transition-colors resize-y font-mono text-sm leading-relaxed ${metadataError ? "border-danger focus:border-danger" : "border-ink-600 focus:border-signal"}`}
              />
              {metadataError && (
                <p className="mt-1 font-mono text-mono-label text-danger">{metadataError}</p>
              )}
            </div>
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Status</label>
              <select
                {...register("published", { setValueAs: (v) => v === "true" || v === true })}
                className="bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi focus:outline-none focus:border-signal transition-colors"
              >
                <option value="false">Draft</option>
                <option value="true">Published</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <SaveButton loading={submitting}>{editing ? "Save Changes" : "Create Document"}</SaveButton>
              <button type="button" onClick={() => setShowForm(false)} className="border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2 hover:border-text-lo transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Documents table ───────────────────────────────────────────────────── */}
      <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              {["Title", "Status", "Updated", ""].map((h) => (
                <th key={h} className="text-left font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-text-lo font-mono text-mono-label">Loading...</td></tr>
            ) : documents.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-text-lo font-mono text-mono-label">No KB documents yet — add one to power the RAG chatbot.</td></tr>
            ) : (
              documents.map((doc) => {
                const citations = analytics?.find((a) => a.docId === doc.id)?.citationCount;
                return (
                  <tr key={doc.id} className="border-b border-line last:border-0 hover:bg-ink-700 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-text-hi font-medium">{doc.title}</span>
                        {citations != null && (
                          <span className="font-mono text-[10px] text-signal border border-signal/30 rounded px-1.5 py-0.5">
                            {citations}×
                          </span>
                        )}
                      </div>
                      <p className="text-text-lo font-mono text-xs mt-0.5 max-w-md truncate">
                        {doc.content.slice(0, 100)}{doc.content.length > 100 ? "…" : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleToggleStatus(doc)}
                        title="Click to toggle status"
                        className={`font-mono text-mono-label uppercase tracking-widest px-2.5 py-1 rounded transition-colors ${
                          doc.published
                            ? "bg-ok/15 text-ok border border-ok/30 hover:bg-ok/25"
                            : "bg-ink-700 text-text-lo border border-line hover:border-text-lo"
                        }`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${doc.published ? "bg-ok" : "bg-text-lo"}`} />
                        {doc.published ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td className="px-5 py-3 font-mono text-mono-label text-text-lo">
                      {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(doc)} className="font-mono text-mono-label text-text-mid hover:text-text-hi transition-colors">Edit</button>
                        <button onClick={() => handleDelete(doc.id)} className="font-mono text-mono-label text-text-lo hover:text-danger transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
