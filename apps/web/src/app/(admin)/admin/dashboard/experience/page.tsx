"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { apiFetch } from "@/lib/admin-api";
import { revalidate } from "@/lib/revalidate";
import { PageHeader } from "@/components/admin/PageHeader";
import { SaveButton } from "@/components/admin/SaveButton";
import { Sk } from "@/components/Skeleton";
import type { ExperienceDto } from "@portfolio/types";

export default function ExperiencePage() {
  const [items, setItems]         = useState<ExperienceDto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<ExperienceDto | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset } = useForm<Omit<ExperienceDto, "id">>();

  async function load() {
    setLoading(true);
    try {
      setItems(await apiFetch<ExperienceDto[]>("/content/experiences"));
    } catch {
      toast.error("Failed to load experience entries");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    reset({ company: "", role: "", startDate: "", endDate: null, summary: "", highlights: [], sortOrder: 0 });
    setShowForm(true);
  }

  function openEdit(item: ExperienceDto) {
    setEditing(item);
    const { id: _id, ...rest } = item;
    reset({
      ...rest,
      startDate: item.startDate.slice(0, 10),
      endDate: item.endDate ? item.endDate.slice(0, 10) : (null as unknown as string),
      highlights: item.highlights.join("\n") as unknown as string[],
    });
    setShowForm(true);
  }

  async function onSubmit(data: Omit<ExperienceDto, "id">) {
    setSubmitting(true);
    try {
      const highlights = typeof data.highlights === "string"
        ? (data.highlights as unknown as string).split("\n").filter(Boolean)
        : data.highlights;
      const body = { ...data, highlights, endDate: data.endDate || null };
      if (editing) {
        await apiFetch(`/content/experiences/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Experience updated");
      } else {
        await apiFetch("/content/experiences", { method: "POST", body: JSON.stringify(body) });
        toast.success("Experience created");
      }
      setShowForm(false);
      void revalidate("experiences");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this experience entry?")) return;
    try {
      await apiFetch(`/content/experiences/${id}`, { method: "DELETE" });
      void revalidate("experiences");
      toast.success("Entry deleted");
      load();
    } catch {
      toast.error("Failed to delete entry");
    }
  }

  return (
    <div>
      <PageHeader index="02 / EXPERIENCE" title="Experience"
        action={<button onClick={openCreate} className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2.5 hover:bg-signal-dim active:scale-[0.98] transition-all">+ Add</button>}
      />

      {showForm && (
        <div className="mb-8 bg-ink-800 border border-ink-600 rounded-card p-6">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">
            {editing ? "Edit Experience" : "New Experience"}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[["Company", "company"], ["Role", "role"]].map(([label, name]) => (
              <div key={name}>
                <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">{label}</label>
                <input {...register(name as "company" | "role", { required: true })} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
              </div>
            ))}
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Start Date</label>
              <input type="date" {...register("startDate", { required: true })} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
            </div>
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">End Date (blank = present)</label>
              <input type="date" {...register("endDate")} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
            </div>
            <div className="col-span-2">
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Summary</label>
              <textarea rows={3} {...register("summary", { required: true })} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
            </div>
            <div className="col-span-2">
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Highlights (one per line)</label>
              <textarea rows={4} {...register("highlights")} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi font-mono text-small" />
            </div>
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Sort Order</label>
              <input type="number" {...register("sortOrder", { valueAsNumber: true })} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
            </div>
            <div className="col-span-2 flex gap-3">
              <SaveButton loading={submitting}>Save</SaveButton>
              <button type="button" onClick={() => setShowForm(false)} className="border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2 hover:border-text-lo transition-all">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-ink-800 border border-ink-600 rounded-card p-5">
              <Sk className="h-6 w-48 mb-2" />
              <Sk className="h-3 w-32 mb-2" />
              <Sk className="h-3 w-40" />
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="text-text-lo font-mono text-mono-label text-center py-12">No experience entries yet — add one above</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-ink-800 border border-ink-600 rounded-card p-5 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
              <div>
                <p className="text-text-hi font-display text-h3">{item.role}</p>
                <p className="font-mono text-mono-label text-signal uppercase tracking-widest mt-1">{item.company}</p>
                <p className="text-text-mid text-small mt-1">{item.startDate.slice(0, 10)} → {item.endDate?.slice(0, 10) ?? "Present"}</p>
                {item.summary && <p className="text-text-lo text-small mt-2 line-clamp-2">{item.summary}</p>}
              </div>
              <div className="flex gap-3 flex-shrink-0">
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
