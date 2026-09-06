"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { apiFetch, apiFetchForm } from "@/lib/admin-api";
import { revalidate } from "@/lib/revalidate";
import { PageHeader } from "@/components/admin/PageHeader";
import { SaveButton } from "@/components/admin/SaveButton";
import { Sk } from "@/components/Skeleton";
import type { ProjectDto } from "@portfolio/types";

const STATUSES = ["shipped", "in_progress", "archived"] as const;

type ProjectFormValues = {
  title: string;
  slug: string;
  tagline: string;
  techStack: string;
  outcomeMetric: string;
  status: "shipped" | "in_progress" | "archived";
  featured: boolean;
  sortOrder: number;
  liveUrl: string;
  githubUrl: string;
  videoUrl: string;
  caseStudyPublished: boolean;
  context: string;
  problem: string;
  architectureDiagram: string;
  keyDecisions: string;
  hardParts: string;
  outcome: string;
};

const EMPTY: ProjectFormValues = {
  title: "", slug: "", tagline: "", techStack: "", outcomeMetric: "",
  status: "shipped", featured: false, sortOrder: 0,
  liveUrl: "", githubUrl: "", videoUrl: "",
  caseStudyPublished: false,
  context: "", problem: "", architectureDiagram: "", keyDecisions: "[]",
  hardParts: "", outcome: "",
};

function dtoToForm(item: ProjectDto): ProjectFormValues {
  return {
    title: item.title, slug: item.slug, tagline: item.tagline,
    techStack: item.techStack.join(", "), outcomeMetric: item.outcomeMetric,
    status: item.status, featured: item.featured, sortOrder: item.sortOrder,
    liveUrl: item.liveUrl ?? "", githubUrl: item.githubUrl ?? "", videoUrl: item.videoUrl ?? "",
    caseStudyPublished: item.caseStudyPublished,
    context: item.context ?? "", problem: item.problem ?? "",
    architectureDiagram: item.architectureDiagram ?? "",
    keyDecisions: JSON.stringify(item.keyDecisions ?? [], null, 2),
    hardParts: item.hardParts ?? "", outcome: item.outcome ?? "",
  };
}

function parseKeyDecisions(raw: string): object[] {
  try { return JSON.parse(raw || "[]") as object[]; } catch { return []; }
}

export default function ProjectsPage() {
  const [items, setItems]           = useState<ProjectDto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<ProjectDto | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [caseStudyOpen, setCaseStudyOpen]     = useState(false);
  const [diagramUrl, setDiagramUrl]           = useState<string | null>(null);
  const [diagramUploading, setDiagramUploading] = useState(false);
  const [diagramError, setDiagramError]       = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset } = useForm<ProjectFormValues>();

  async function load() {
    setLoading(true);
    try {
      setItems(await apiFetch<ProjectDto[]>("/content/projects"));
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    reset(EMPTY);
    setCaseStudyOpen(false);
    setDiagramUrl(null);
    setDiagramError(null);
    setShowForm(true);
  }

  function openEdit(item: ProjectDto) {
    setEditing(item);
    reset(dtoToForm(item));
    setCaseStudyOpen(item.caseStudyPublished || !!item.context || !!item.problem);
    setDiagramUrl(item.diagramImageUrl ?? null);
    setDiagramError(null);
    setShowForm(true);
  }

  async function handleDiagramUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editing || !e.target.files?.[0]) return;
    setDiagramUploading(true);
    setDiagramError(null);
    try {
      const form = new FormData();
      form.append("file", e.target.files[0]);
      const res = await apiFetchForm<{ diagramImageUrl: string }>(
        `/content/projects/${editing.id}/diagram`,
        { method: "POST", body: form },
      );
      setDiagramUrl(res.diagramImageUrl);
      setItems((prev) => prev.map((p) => p.id === editing.id ? { ...p, diagramImageUrl: res.diagramImageUrl } : p));
      toast.success("Diagram uploaded");
    } catch (err) {
      setDiagramError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setDiagramUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDiagramDelete() {
    if (!editing || !confirm("Remove diagram image?")) return;
    try {
      await apiFetch(`/content/projects/${editing.id}/diagram`, { method: "DELETE" });
      setDiagramUrl(null);
      setItems((prev) => prev.map((p) => p.id === editing.id ? { ...p, diagramImageUrl: null } : p));
      toast.success("Diagram removed");
    } catch {
      toast.error("Failed to remove diagram");
    }
  }

  async function onSubmit(data: ProjectFormValues) {
    setSubmitting(true);
    try {
      const body = {
        title: data.title, slug: data.slug, tagline: data.tagline,
        techStack: data.techStack.split(",").map((s) => s.trim()).filter(Boolean),
        outcomeMetric: data.outcomeMetric, status: data.status,
        featured: Boolean(data.featured), sortOrder: Number(data.sortOrder) || 0,
        liveUrl: data.liveUrl || null, githubUrl: data.githubUrl || null, videoUrl: data.videoUrl || null,
        caseStudyPublished: Boolean(data.caseStudyPublished),
        context: data.context || null, problem: data.problem || null,
        architectureDiagram: data.architectureDiagram || null,
        keyDecisions: parseKeyDecisions(data.keyDecisions),
        hardParts: data.hardParts || null, outcome: data.outcome || null,
      };
      if (editing) {
        await apiFetch(`/content/projects/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Project updated");
      } else {
        await apiFetch("/content/projects", { method: "POST", body: JSON.stringify(body) });
        toast.success("Project created");
      }
      setShowForm(false);
      void revalidate("projects");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    try {
      await apiFetch(`/content/projects/${id}`, { method: "DELETE" });
      void revalidate("projects");
      toast.success("Project deleted");
      load();
    } catch {
      toast.error("Failed to delete project");
    }
  }

  const inp = (label: string, name: keyof ProjectFormValues) => (
    <div>
      <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">{label}</label>
      <input {...register(name)} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
    </div>
  );

  const ta = (label: string, name: keyof ProjectFormValues, rows = 4) => (
    <div>
      <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">{label}</label>
      <textarea {...register(name)} rows={rows} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi font-mono text-small resize-y" />
    </div>
  );

  return (
    <div>
      <PageHeader
        index="03 / PROJECTS"
        title="Projects"
        action={
          <button onClick={openCreate} className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2.5 hover:bg-signal-dim active:scale-[0.98] transition-all">
            + Add
          </button>
        }
      />

      {showForm && (
        <div className="mb-8 bg-ink-800 border border-ink-600 rounded-card p-6">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">
            {editing ? "Edit Project" : "New Project"}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inp("Title", "title")}
              <div>
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">
                  Slug {editing && <span className="text-text-lo normal-case tracking-normal text-[10px] ml-1">(locked after create — changing breaks existing URLs)</span>}
                </label>
                <input
                  {...register("slug")}
                  disabled={!!editing}
                  className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
              <div className="col-span-2">{inp("Tagline", "tagline")}</div>
              <div className="col-span-2">{inp("Outcome Metric", "outcomeMetric")}</div>
              <div className="col-span-2">
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Tech Stack (comma-separated)</label>
                <input {...register("techStack")} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
              </div>
              <div>
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Status</label>
                <select {...register("status")} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Sort Order</label>
                <input type="number" {...register("sortOrder")} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="featured" {...register("featured")} className="accent-signal w-4 h-4" />
                <label htmlFor="featured" className="font-mono text-mono-label text-text-mid uppercase tracking-widest">Featured</label>
              </div>
            </div>

            <div className="border-t border-ink-600 pt-5">
              <p className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">Links — leave blank for NDA/private</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {inp("Live URL", "liveUrl")}
                {inp("GitHub URL", "githubUrl")}
                {inp("Video URL", "videoUrl")}
              </div>
            </div>

            <div className="border-t border-ink-600 pt-5">
              <button
                type="button"
                onClick={() => setCaseStudyOpen((o) => !o)}
                className="flex items-center gap-2 font-mono text-mono-label text-text-mid uppercase tracking-widest hover:text-text-hi transition-colors w-full text-left"
              >
                <span className={`inline-block transition-transform duration-150 ${caseStudyOpen ? "rotate-90" : ""}`}>▶</span>
                Case Study Write-up
              </button>

              {caseStudyOpen && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="caseStudyPublished" {...register("caseStudyPublished")} className="accent-signal w-4 h-4" />
                    <label htmlFor="caseStudyPublished" className="font-mono text-mono-label text-text-mid uppercase tracking-widest">Published</label>
                  </div>
                  {ta("Context", "context")}
                  {ta("The Problem", "problem")}
                  {ta("Architecture Diagram (ASCII / Mermaid)", "architectureDiagram")}

                  <div>
                    <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-2">Diagram Image</label>
                    {diagramError && (
                      <div className="mb-2 font-mono text-small text-danger bg-danger/10 border border-danger/30 rounded-btn px-3 py-2">{diagramError}</div>
                    )}
                    {diagramUrl ? (
                      <div className="space-y-2">
                        <img src={diagramUrl} alt="Architecture diagram" className="max-h-48 rounded border border-ink-600 object-contain bg-ink-900" />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={diagramUploading || !editing}
                            className="font-mono text-mono-label text-text-mid border border-ink-600 rounded px-3 py-1.5 hover:border-text-lo transition-colors disabled:opacity-40">
                            {diagramUploading ? "Uploading…" : "Replace"}
                          </button>
                          <button type="button" onClick={() => void handleDiagramDelete()} disabled={diagramUploading || !editing}
                            className="font-mono text-mono-label text-danger border border-danger/30 rounded px-3 py-1.5 hover:bg-danger/10 transition-colors disabled:opacity-40">
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={diagramUploading || !editing}
                        className="flex items-center gap-2 font-mono text-mono-label text-text-lo border border-dashed border-ink-600 rounded px-4 py-3 hover:border-text-lo hover:text-text-mid transition-colors disabled:opacity-40">
                        {diagramUploading ? "Uploading…" : !editing ? "Save project first to upload image" : "↑ Upload diagram image"}
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleDiagramUpload(e)} />
                  </div>

                  {ta("Key Decisions (JSON array)", "keyDecisions")}
                  <p className="font-mono text-[10px] text-text-lo -mt-2">{`Format: [{"title":"…","chosen":"…","alternative":"…","rationale":"…"}]`}</p>
                  {ta("Hard Parts", "hardParts")}
                  {ta("Outcome", "outcome")}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-ink-600 pt-5">
              <SaveButton loading={submitting}>Save</SaveButton>
              <button type="button" onClick={() => setShowForm(false)} className="border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2 hover:border-text-lo transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-ink-800 border border-ink-600 rounded-card p-5">
              <div className="flex justify-between items-start mb-3"><Sk className="h-6 w-2/3" /><Sk className="h-3 w-16" /></div>
              <Sk className="h-4 w-full mb-1.5" /><Sk className="h-3 w-1/2 mb-3" />
              <div className="flex gap-2 mb-4"><Sk className="h-5 w-12 rounded" /><Sk className="h-5 w-16 rounded" /></div>
              <div className="flex gap-3"><Sk className="h-3 w-8" /><Sk className="h-3 w-10" /></div>
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="col-span-2 text-text-lo font-mono text-mono-label text-center py-12">No projects yet — add one above</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-ink-800 border border-ink-600 rounded-card p-5">
              <div className="flex justify-between items-start mb-2">
                <p className="font-display text-h3 text-text-hi">{item.title}</p>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {item.caseStudyPublished && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-signal border border-signal/30 rounded px-1.5 py-0">Case Study</span>
                  )}
                  <span className="font-mono text-mono-label text-text-lo">{item.status}</span>
                </div>
              </div>
              <p className="text-text-mid text-small mb-2">{item.tagline}</p>
              <p className="font-mono text-mono-label text-signal mb-3">{item.outcomeMetric}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {item.liveUrl && <a href={item.liveUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase tracking-widest text-text-lo border border-ink-600 rounded px-2 py-0.5 hover:text-signal hover:border-signal/40 transition-colors">Live ↗</a>}
                {item.githubUrl && <a href={item.githubUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase tracking-widest text-text-lo border border-ink-600 rounded px-2 py-0.5 hover:text-signal hover:border-signal/40 transition-colors">GitHub ↗</a>}
                {!item.liveUrl && !item.githubUrl && <span className="font-mono text-[10px] uppercase tracking-widest text-text-lo border border-line rounded px-2 py-0.5">NDA</span>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => openEdit(item)} className="font-mono text-mono-label text-text-mid hover:text-text-hi transition-colors">Edit</button>
                <button onClick={() => handleDelete(item.id)} className="font-mono text-mono-label text-text-lo hover:text-danger transition-colors">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
