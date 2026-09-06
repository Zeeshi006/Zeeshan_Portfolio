# Admin Panel — Gap Analysis & Feature Roadmap

> Audit date: 2026-09-02. All findings are verified against source files in `apps/web/src/app/(admin)/`.

---

## 1. Critical Bugs (Fix Before Anything Else)

These are silent failures — the user gets no feedback that something went wrong.

| # | Location | Problem | Fix |
|---|---|---|---|
| 1 | `projects/page.tsx` | `onSubmit` has no try/catch. API errors are swallowed silently | Wrap in try/catch, set `formError` state |
| 2 | `content/page.tsx` | `saveHero`, `saveAbout`, `saveAvailability` — if the API throws, `flash()` never runs. User sees nothing | Add try/catch + per-section error state |
| 3 | `skills/page.tsx` | Every async fn (`load`, `toggleFeatured`, `onSubmit`, `handleDelete`) has no try/catch. If `load()` throws, `setLoading(false)` is never called → skeleton spins forever | Wrap all in try/catch |
| 4 | `skills/page.tsx` | `handleDelete` for skills and categories never calls `revalidate()` | Call `revalidate("skills")` after delete |
| 5 | `experience/page.tsx` | `handleDelete` never calls `revalidate()` | Call `revalidate("experiences")` after delete |
| 6 | `projects/page.tsx` | Diagram upload failure shows `window.alert()` — only native browser dialog in the whole admin | Replace with inline error banner |
| 7 | All CRUD pages | Save buttons have no `disabled` state during API calls — rapid double-clicks fire duplicate mutations | Add `submitting` boolean, disable button + show spinner |

---

## 2. UX Gaps (Patterns That Are Inconsistent or Absent)

### 2.1 No Toast / Notification System

Every page invents its own success/error feedback:
- Site Content: a single shared "Saved" banner for 3 independent save actions
- Blog: a `msg` string below the form
- Skills: no success feedback at all
- Projects: no success or error feedback on submit
- Chatbot Settings: persistent colored text that never clears

**Fix:** Install one library (`sonner` is tiny, aligns with the dark theme). Replace all ad-hoc banners, `msg` strings, and colored divs with `toast.success()` / `toast.error()`. One import, consistent UX everywhere.

### 2.2 No Loading State on Save Buttons

Every form's Save button is always enabled and shows no spinner. A slow connection looks like nothing is happening. Users click twice, fire duplicate mutations.

**Fix:** A single reusable `<SaveButton loading={submitting}>Save</SaveButton>` component with a spinner. Disable it and show a spinner glyph while `submitting === true`.

### 2.3 Skills Page — Category Edit Is Missing

You can create and delete categories but not rename or reorder them. Because skills store the category as a plain string (not an ID), there's also no FK to update — renaming requires updating all skills that reference the old name.

**Fix:** Add an edit pencil on each category pill. On save, PATCH the category record and batch-update all skills with the old name to the new one (one API call).

### 2.4 Blog — No Content Preview

The blog editor is a plain `<textarea>`. Writing Markdown with no rendered preview is a real friction point for longer posts.

**Fix:** A two-panel split: textarea on the left, rendered Markdown on the right (use `marked` or `react-markdown`, both tiny). Toggle with a "Preview" button if screen space is tight.

### 2.5 Blog — No Unsaved-Changes Warning

Navigating away from the blog editor or closing the tab silently discards everything written. There is no autosave and no `beforeunload` warning.

**Fix:** Track a `dirty` boolean (`form !== initialForm`). Block the "← Back" link with a confirm dialog if dirty. Optionally `localStorage`-autosave the draft every 30s.

### 2.6 Blog — Locked Slug Has No Explanation

In edit mode the slug input is `disabled` with no tooltip or label. Users don't know they can't change it or why.

**Fix:** Add a small help text: _"Slug is locked after publish to preserve existing URLs."_ Or allow slug change with a warning that it breaks old links.

### 2.7 Dashboard Cards Are Incomplete

The dashboard shows 7 cards. The sidebar has 13 items. Blog, GitHub, Chatbot Settings, Voice Settings, and Security are not on the dashboard. A new user would never discover them from the landing page.

**Fix:** Either make the dashboard a full-grid of all 13 sections with icons and a one-line description, or rename it to "Quick access" and add a "More" group at the bottom for the remaining 5.

### 2.8 Conversations — No Debounce on Search

Every keystroke fires a new API call (search is in a `useEffect` dependency). On a slow server this causes racing responses.

**Fix:** Wrap the search state update in a 300ms debounce (`useDebounce` hook — 10 lines).

### 2.9 IP Blocklist — No Validation

Typing `lol` and pressing Enter POSTs it to `/chat/blocklist`. No client-side format check.

**Fix:** Validate with a simple IPv4/IPv6 regex before the API call. Show an inline error if invalid.

### 2.10 Analytics Intervals Never Pause

The analytics page runs `setInterval` at 30s and 60s. Leaving the tab open overnight makes hundreds of calls. There is no pause on `document.hidden`.

**Fix:** Add a `visibilitychange` listener — clear the intervals when hidden, restart when visible again.

---

## 3. Missing Features (Functional Gaps in Current Scope)

### 3.1 Projects — Two-Step Diagram Upload

Diagram upload is disabled on create mode. You must: create → save → re-enter edit → upload. This is accidental friction from the implementation.

**Fix:** Allow diagram upload inline after a first successful create. Or: optimistically hold the file in state, upload it immediately after the create call completes, patch the project with the returned URL — one smooth flow.

### 3.2 Site Content — Profile Photo / Avatar Upload

There is no way to upload or change the profile photo from the admin. It's presumably a static asset or a hardcoded URL.

**Fix:** Add a Cloudinary upload slot in the Content page (same pattern as Projects diagram upload already in place).

### 3.3 Site Content — Social Links

No UI to manage LinkedIn, GitHub, X, email, CV download URL. These likely live as hardcoded values in the frontend.

**Fix:** Add a Social Links section to the Content page with fields for each platform + a CV/resume upload.

### 3.4 Security — No Password Change

The Security page covers passkeys only. There is no way to change the admin password from the UI. Doing so currently requires a server-side bcrypt hash + env var change.

**Fix:** Add a Change Password card — current password + new password + confirm. POST to a protected endpoint that re-hashes and updates.

### 3.5 Security — No Login Audit Log

There is no record of when the admin logged in, from what IP, or how many failed attempts occurred.

**Fix:** A simple read-only table of the last 20 login events (timestamp, IP, method: password/passkey, result: success/fail). Store in Postgres, query in the security page.

### 3.6 Conversations — No Delete / Prune

Conversations accumulate indefinitely. There is no way to delete a specific conversation or bulk-delete conversations older than N days.

**Fix:** Add a "Delete" button on each conversation row (with confirm), and a "Prune conversations older than 30 days" bulk action at the top.

### 3.7 Knowledge Base — No ElevenLabs Sync Confirmation

"Sync to ElevenLabs" fires immediately on click. This is a destructive-ish action (overwrites the voice agent KB, consumes quota).

**Fix:** Add a confirm dialog: _"This will overwrite the ElevenLabs knowledge base. Continue?"_

---

## 4. Transformative Features (Would Make This Admin Genuinely Impressive)

These go beyond fixing what's broken — they make the admin panel itself a portfolio artifact.

### 4.1 Rich Text / Markdown Editor for Blog

Replace the plain textarea with a minimal rich editor (Tiptap or CodeMirror with Markdown mode). Features that matter:
- Live side-by-side preview
- Drag-and-drop image upload (Cloudinary)
- Code block with syntax highlight
- Frontmatter panel (tags, excerpt, SEO meta, cover image) as a structured sidebar — not raw YAML
- Word count + estimated reading time updating live

This alone makes the blog admin feel like a real CMS.

### 4.2 Drag-and-Drop Sort Order

Skills, experience entries, and projects all have a `sortOrder` field but the only way to change it is to type a number in a field. Nobody does this.

**Fix:** Make list rows draggable (use `@dnd-kit/sortable` — small, accessible). Drag to reorder, PATCH sort orders in one batch call on drop. The UI goes from a number field buried in a form to a natural gesture.

### 4.3 Inline Editable Cells (Skills Table)

For the skills table specifically, clicking the name, category, or proficiency level directly in the table row should make that cell editable in-place (contentEditable or a positioned input). Tab moves to the next field. Escape cancels. Enter saves.

This removes the "click Edit → panel opens → change one field → Save → panel closes" round-trip for small changes. The featured ★ toggle is already this pattern — extend it to all cells.

### 4.4 Content Change Preview ("Preview Before Publish")

When editing hero copy, about text, or project details, a "Preview" button should open the public site in a preview mode with the unsaved draft data — without publishing it. This could be implemented with a short-lived signed preview token that Next.js Draft Mode supports natively.

### 4.5 Chatbot Playground (KB Testing Inline)

The KB page has a simple chatbot test box. Promote this into a proper "Playground" tab:
- Left panel: send a message to the chatbot
- Right panel: see the retrieved source chunks (the RAG context that was used), the system prompt, token counts, and which KB documents were cited
- This makes the admin panel demonstrable as a technical artifact — a recruiter can watch RAG in real time

### 4.6 Analytics: "Live" View

Add a real-time panel to the analytics page showing the current live sessions (powered by the WebSocket already implemented on the system page). Show active path, time on site, and referrer. Small and tasteful — one card at the top of the analytics page — but it demonstrates the WebSocket infra in the most visible way possible.

### 4.7 One-Click Site Health Check

A "Health" card on the dashboard that pings: API `/health`, DB connection, Redis, the LLM provider, and the ElevenLabs agent. Shows each as a green/red indicator. Useful operationally and demonstrates the Terminus health endpoint you've already built.

### 4.8 Revalidation Status

After clicking any "Publish" action that triggers ISR revalidation, show the user confirmation that the public site was revalidated: _"✓ Public site updated"_. Currently `revalidate()` is a fire-and-forget call with no feedback — the user doesn't know if it worked.

---

## 5. Implementation Priority

**Do these first (high impact, low effort):**
1. Install `sonner`, replace all ad-hoc feedback with `toast.success` / `toast.error`
2. Add `submitting` state + disabled Save buttons with spinner on all CRUD pages
3. Add try/catch + error handling to Skills, Projects, Site Content
4. Call `revalidate()` on skills delete and experience delete
5. Fix the `window.alert()` in Projects diagram upload

**Do these second (medium effort, close real gaps):**
6. Blog Markdown preview (split panel)
7. Blog unsaved-changes warning (`beforeunload` + dirty check)
8. Category rename + batch-update skills
9. Drag-and-drop sort order (dnd-kit)
10. Password change UI on Security page

**Do these third (transformative, takes a sprint each):**
11. Rich blog editor (Tiptap)
12. Chatbot Playground with RAG context visibility
13. Content preview with Next.js Draft Mode
14. Login audit log
15. Live analytics panel (WebSocket)
