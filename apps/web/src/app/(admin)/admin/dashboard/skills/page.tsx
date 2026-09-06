"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { apiFetch } from "@/lib/admin-api";
import { revalidate } from "@/lib/revalidate";
import { PageHeader } from "@/components/admin/PageHeader";
import { SaveButton } from "@/components/admin/SaveButton";
import { Sk } from "@/components/Skeleton";
import type { SkillDto, SkillCategoryDto } from "@portfolio/types";

type SkillForm = Omit<SkillDto, "id">;

export default function SkillsPage() {
  const [skills, setSkills]         = useState<SkillDto[]>([]);
  const [categories, setCategories] = useState<SkillCategoryDto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<SkillDto | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Category inline add
  const [newCatName, setNewCatName]   = useState("");
  const [newCatOrder, setNewCatOrder] = useState(0);
  const [catAdding, setCatAdding]     = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);

  // Category inline edit
  const [editingCat, setEditingCat]     = useState<SkillCategoryDto | null>(null);
  const [editCatName, setEditCatName]   = useState("");
  const [editCatOrder, setEditCatOrder] = useState(0);
  const [catSaving, setCatSaving]       = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm<SkillForm>();

  async function load() {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        apiFetch<SkillDto[]>("/content/skills"),
        apiFetch<SkillCategoryDto[]>("/content/skill-categories"),
      ]);
      setSkills(s);
      setCategories(c);
    } catch {
      toast.error("Failed to load skills");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    reset({ name: "", category: categories[0]?.name ?? "", proficiencyLevel: 3, featured: false, sortOrder: 0 });
    setShowForm(true);
  }

  function openEdit(skill: SkillDto) {
    setEditing(skill);
    setValue("name", skill.name);
    setValue("category", skill.category);
    setValue("proficiencyLevel", skill.proficiencyLevel);
    setValue("featured", skill.featured);
    setValue("sortOrder", skill.sortOrder);
    setShowForm(true);
  }

  async function toggleFeatured(skill: SkillDto) {
    try {
      await apiFetch(`/content/skills/${skill.id}`, {
        method: "PATCH",
        body: JSON.stringify({ featured: !skill.featured }),
      });
      void revalidate("skills");
      toast.success(skill.featured ? "Removed from spotlight" : "Added to spotlight");
      load();
    } catch {
      toast.error("Failed to update spotlight");
    }
  }

  async function onSubmit(data: SkillForm) {
    setSubmitting(true);
    try {
      if (editing) {
        await apiFetch(`/content/skills/${editing.id}`, { method: "PATCH", body: JSON.stringify(data) });
        toast.success("Skill updated");
      } else {
        await apiFetch("/content/skills", { method: "POST", body: JSON.stringify(data) });
        toast.success("Skill created");
      }
      setShowForm(false);
      void revalidate("skills");
      load();
    } catch {
      toast.error("Failed to save skill");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this skill?")) return;
    try {
      await apiFetch(`/content/skills/${id}`, { method: "DELETE" });
      void revalidate("skills");
      toast.success("Skill deleted");
      load();
    } catch {
      toast.error("Failed to delete skill");
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setCatAdding(true);
    try {
      await apiFetch("/content/skill-categories", {
        method: "POST",
        body: JSON.stringify({ name: newCatName.trim(), sortOrder: newCatOrder }),
      });
      setNewCatName("");
      setNewCatOrder(0);
      setShowCatForm(false);
      toast.success("Category added");
      load();
    } catch {
      toast.error("Failed to add category");
    } finally {
      setCatAdding(false);
    }
  }

  function openEditCat(cat: SkillCategoryDto) {
    setEditingCat(cat);
    setEditCatName(cat.name);
    setEditCatOrder(cat.sortOrder);
  }

  async function handleSaveCategory() {
    if (!editingCat || !editCatName.trim()) return;
    setCatSaving(true);
    try {
      await apiFetch(`/content/skill-categories/${editingCat.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editCatName.trim(), sortOrder: editCatOrder }),
      });
      setEditingCat(null);
      toast.success("Category updated");
      load();
    } catch {
      toast.error("Failed to update category");
    } finally {
      setCatSaving(false);
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? Skills using it will keep their category value.`)) return;
    try {
      await apiFetch(`/content/skill-categories/${id}`, { method: "DELETE" });
      toast.success("Category deleted");
      load();
    } catch {
      toast.error("Failed to delete category");
    }
  }

  return (
    <div>
      <PageHeader
        index="01 / SKILLS"
        title="Skills"
        action={
          <button onClick={openCreate} className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2.5 hover:bg-signal-dim active:scale-[0.98] transition-all">
            + Add Skill
          </button>
        }
      />

      {/* ── Categories management ────────────────────────────────────────── */}
      <div className="mb-6 bg-ink-800 border border-ink-600 rounded-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest">Categories</h2>
          <button
            onClick={() => { setShowCatForm(v => !v); setEditingCat(null); }}
            className="font-mono text-mono-label text-signal hover:text-signal-dim uppercase tracking-widest transition-colors"
          >
            + Add
          </button>
        </div>

        {showCatForm && (
          <div className="flex gap-3 mb-4 flex-wrap">
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Category name"
              className="flex-1 min-w-[160px] bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi font-mono text-sm"
            />
            <input
              type="number"
              value={newCatOrder}
              onChange={e => setNewCatOrder(Number(e.target.value))}
              placeholder="Order"
              className="w-20 bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi font-mono text-sm"
            />
            <button
              onClick={handleAddCategory}
              disabled={catAdding || !newCatName.trim()}
              className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-2 hover:bg-signal-dim disabled:opacity-40 transition-all"
            >
              Save
            </button>
            <button
              onClick={() => setShowCatForm(false)}
              className="border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-2 hover:border-text-lo transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Category edit row */}
        {editingCat && (
          <div className="flex gap-3 mb-4 flex-wrap items-center p-3 bg-ink-700 rounded-btn">
            <span className="font-mono text-mono-label text-text-lo">Editing:</span>
            <input
              value={editCatName}
              onChange={e => setEditCatName(e.target.value)}
              className="flex-1 min-w-[140px] bg-ink-900 border border-signal/40 rounded-btn px-3 py-1.5 text-text-hi font-mono text-sm"
            />
            <input
              type="number"
              value={editCatOrder}
              onChange={e => setEditCatOrder(Number(e.target.value))}
              className="w-20 bg-ink-900 border border-ink-600 rounded-btn px-3 py-1.5 text-text-hi font-mono text-sm"
            />
            <button
              onClick={handleSaveCategory}
              disabled={catSaving}
              className="bg-signal text-signal-ink font-mono text-mono-label uppercase tracking-widest rounded-btn px-4 py-1.5 hover:bg-signal-dim disabled:opacity-40 transition-all"
            >
              {catSaving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditingCat(null)} className="font-mono text-mono-label text-text-lo hover:text-text-hi transition-colors">
              Cancel
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-6 w-20 rounded-full" />)}
          </div>
        ) : categories.length === 0 ? (
          <p className="font-mono text-mono-label text-text-lo">No categories yet.</p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1 bg-ink-700 border border-ink-600 rounded-full pl-3 pr-1.5 py-1">
                <span className="font-mono text-[11px] text-text-hi">{cat.name}</span>
                <button
                  onClick={() => openEditCat(cat)}
                  className="text-text-lo hover:text-signal transition-colors leading-none font-mono text-xs px-0.5"
                  aria-label={`Edit ${cat.name}`}
                  title="Edit category"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="text-text-lo hover:text-danger transition-colors leading-none font-mono text-xs"
                  aria-label={`Delete ${cat.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Skill form ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className="mb-8 bg-ink-800 border border-ink-600 rounded-card p-6">
          <h2 className="font-mono text-mono-label text-text-lo uppercase tracking-widest mb-4">
            {editing ? "Edit Skill" : "New Skill"}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Name</label>
              <input {...register("name", { required: true })} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
            </div>
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Category</label>
              <select {...register("category", { required: true })} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi">
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              {categories.length === 0 && (
                <p className="font-mono text-[10px] text-warn mt-1">Add at least one category above first.</p>
              )}
            </div>
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Proficiency (1–5)</label>
              <input type="number" min={1} max={5} {...register("proficiencyLevel", { valueAsNumber: true })} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
            </div>
            <div>
              <label className="block font-mono text-mono-label text-text-lo uppercase tracking-widest mb-1">Sort Order</label>
              <input type="number" {...register("sortOrder", { valueAsNumber: true })} className="w-full bg-ink-900 border border-ink-600 rounded-btn px-3 py-2 text-text-hi" />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input type="checkbox" id="featured" {...register("featured")} className="accent-signal w-4 h-4" />
              <label htmlFor="featured" className="font-mono text-mono-label text-text-mid uppercase tracking-widest cursor-pointer">
                Featured spotlight card <span className="text-signal">★</span>
              </label>
              <span className="font-mono text-[10px] text-text-lo">(max 4 shown)</span>
            </div>
            <div className="col-span-2 flex gap-3">
              <SaveButton loading={submitting}>Save</SaveButton>
              <button type="button" onClick={() => setShowForm(false)} className="border border-ink-600 text-text-hi font-mono text-mono-label uppercase tracking-widest rounded-btn px-5 py-2 hover:border-text-lo transition-all">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Skills table ─────────────────────────────────────────────────── */}
      <div className="bg-ink-800 border border-ink-600 rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-line">
              {["Name", "Category", "Level", "★", "Order", ""].map(h => (
                <th key={h} className="text-left font-mono text-mono-label text-text-lo uppercase tracking-widest px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-5 py-3"><Sk className="h-4 w-32" /></td>
                  <td className="px-5 py-3"><Sk className="h-3 w-20" /></td>
                  <td className="px-5 py-3"><Sk className="h-3 w-8" /></td>
                  <td className="px-5 py-3"><Sk className="h-3 w-4" /></td>
                  <td className="px-5 py-3"><Sk className="h-3 w-8" /></td>
                  <td className="px-5 py-3"><div className="flex gap-3"><Sk className="h-3 w-8" /><Sk className="h-3 w-10" /></div></td>
                </tr>
              ))
            ) : skills.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-text-lo font-mono text-mono-label">No skills yet — add one above</td></tr>
            ) : (
              skills.map(skill => (
                <tr key={skill.id} className="border-b border-line last:border-0 hover:bg-ink-700 transition-colors">
                  <td className="px-5 py-3 text-text-hi">{skill.name}</td>
                  <td className="px-5 py-3 font-mono text-mono-label text-text-mid">{skill.category}</td>
                  <td className="px-5 py-3 font-mono text-signal">{skill.proficiencyLevel}/5</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleFeatured(skill)}
                      title={skill.featured ? "Remove from spotlight" : "Add to spotlight"}
                      className={`text-lg leading-none transition-colors ${skill.featured ? "text-signal" : "text-ink-600 hover:text-text-lo"}`}
                    >
                      ★
                    </button>
                  </td>
                  <td className="px-5 py-3 font-mono text-mono-label text-text-lo">{skill.sortOrder}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(skill)} className="font-mono text-mono-label text-text-mid hover:text-text-hi transition-colors">Edit</button>
                      <button onClick={() => handleDelete(skill.id)} className="font-mono text-mono-label text-text-lo hover:text-danger transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
