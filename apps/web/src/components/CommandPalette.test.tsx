import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Framer-motion mock (same pattern as SpeedDial.test.tsx) ───────────────────

vi.mock("framer-motion", () => {
  const React = require("react");
  const forward = (tag: string) =>
    React.forwardRef(
      ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<unknown>) => {
        const domProps = Object.fromEntries(
          Object.entries(rest).filter(
            ([k]) =>
              !["initial", "animate", "exit", "variants", "transition", "whileHover", "whileTap", "layoutId", "layout"].includes(k),
          ),
        );
        return React.createElement(tag, { ...domProps, ref }, children);
      },
    );
  return {
    motion: new Proxy({}, { get: (_t, prop) => forward(String(prop)) }),
    AnimatePresence: ({ children }: React.PropsWithChildren) => children,
  };
});

// ── DOM helpers ───────────────────────────────────────────────────────────────

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSearchResponse(overrides: Partial<{
  projects: object[]; skills: object[]; experiences: object[]; posts: object[]; total: number;
}> = {}) {
  return {
    projects: [],
    skills: [],
    experiences: [],
    posts: [],
    total: 0,
    ...overrides,
  };
}

// ── Import after mocks ────────────────────────────────────────────────────────

// Dynamic import so the module-level `store` singleton isn't shared between
// test files, avoiding cross-test state leaks when tests run sequentially.
import { CommandPalette, usePaletteStore, openPalette, closePalette } from "./CommandPalette";

// ── open/close helpers ────────────────────────────────────────────────────────

function OpenButton() {
  const { open } = usePaletteStore();
  return <button onClick={open} data-testid="open">Open</button>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CommandPalette", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    localStorage.clear();
    act(() => { closePalette(); });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Closed state ────────────────────────────────────────────────────────────

  describe("when closed", () => {
    it("renders nothing visible initially", () => {
      // Start fresh with a close, then render
      const { container } = render(<CommandPalette />);
      // The palette dialog should not be present when closed
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(container).toBeDefined();
    });
  });

  // ── Open state ──────────────────────────────────────────────────────────────

  describe("when open", () => {
    function renderOpen() {
      const utils = render(
        <>
          <OpenButton />
          <CommandPalette />
        </>,
      );
      fireEvent.click(screen.getByTestId("open"));
      return utils;
    }

    it("shows the dialog with search input", () => {
      renderOpen();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("focuses the input on open", async () => {
      renderOpen();
      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole("textbox"));
      });
    });

    it("closes on Escape key", () => {
      renderOpen();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.keyDown(document, { key: "Escape" });
      // AnimatePresence in test renders synchronously, dialog should be gone
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows ESC close button", () => {
      renderOpen();
      // ESC appears in both the input row and the footer
      const escKeys = screen.getAllByText("ESC");
      expect(escKeys.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── NAVIGATE mode ───────────────────────────────────────────────────────────

  describe("NAVIGATE mode (empty query)", () => {
    function renderOpen() {
      render(<><OpenButton /><CommandPalette /></>);
      fireEvent.click(screen.getByTestId("open"));
    }

    it("shows SECTIONS group header", () => {
      renderOpen();
      const sectionHeaders = screen.getAllByText(/sections/i);
      expect(sectionHeaders.length).toBeGreaterThan(0);
    });

    it("shows ACTIONS group header", () => {
      renderOpen();
      const headers = screen.getAllByText(/actions/i);
      expect(headers.length).toBeGreaterThan(0);
    });

    it("shows all section nav commands", () => {
      renderOpen();
      expect(screen.getByText("Skills")).toBeInTheDocument();
      expect(screen.getByText("Experience")).toBeInTheDocument();
      expect(screen.getByText("Projects")).toBeInTheDocument();
      expect(screen.getByText("Contact")).toBeInTheDocument();
    });

    it("shows action commands", () => {
      renderOpen();
      expect(screen.getByText("Open Chat")).toBeInTheDocument();
      expect(screen.getByText("Download Resume")).toBeInTheDocument();
    });

    it("navigates with ArrowDown/ArrowUp keys", () => {
      renderOpen();
      const input = screen.getByRole("textbox");
      // First item is selected (index 0) — arrow down should move to index 1
      fireEvent.keyDown(input.parentElement!, { key: "ArrowDown" });
      // The second item should now have aria-selected=true
      const options = screen.getAllByRole("option");
      expect(options[1]!.getAttribute("aria-selected")).toBe("true");
    });

    it("shows footer hint '↑↓ navigate'", () => {
      renderOpen();
      expect(screen.getByText("navigate")).toBeInTheDocument();
    });

    it("shows '? ask AI' footer hint", () => {
      renderOpen();
      expect(screen.getByText("ask AI")).toBeInTheDocument();
    });
  });

  // ── SEARCH mode ─────────────────────────────────────────────────────────────

  describe("SEARCH mode (plain text query)", () => {
    function renderAndSearch(query: string) {
      render(<><OpenButton /><CommandPalette /></>);
      fireEvent.click(screen.getByTestId("open"));
      fireEvent.change(screen.getByRole("textbox"), { target: { value: query } });
    }

    it("calls /search endpoint after debounce", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeSearchResponse(),
      });
      global.fetch = mockFetch;

      renderAndSearch("typescript");

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/search?q=typescript"),
          );
        },
        { timeout: 1000 },
      );
    });

    it("shows 'Searching…' loading state immediately", async () => {
      global.fetch = vi.fn().mockImplementation(
        () => new Promise(() => {/* never resolves */}),
      );
      renderAndSearch("nestjs");
      await waitFor(() => {
        expect(screen.getByText("Searching…")).toBeInTheDocument();
      });
    });

    it("shows 'No results' empty state when API returns zero results", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeSearchResponse({ total: 0 }),
      });
      renderAndSearch("zzznoresults");
      await waitFor(
        () => {
          expect(screen.getByText(/no results for/i)).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it("renders grouped project results", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          makeSearchResponse({
            projects: [
              { type: "project", id: "p1", title: "Portfolio Platform", subtitle: "NestJS app", href: "/projects/portfolio", meta: "NestJS" },
            ],
            total: 1,
          }),
      });
      renderAndSearch("portfolio");
      await waitFor(() => {
        expect(screen.getByText("Portfolio Platform")).toBeInTheDocument();
        expect(screen.getByText("PROJ")).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it("renders skill results with SKILL type label", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          makeSearchResponse({
            skills: [
              { type: "skill", id: "s1", title: "TypeScript", subtitle: "backend", href: "/#skills", meta: "5/5" },
            ],
            total: 1,
          }),
      });
      renderAndSearch("typescript");
      await waitFor(() => {
        expect(screen.getByText("TypeScript")).toBeInTheDocument();
        expect(screen.getByText("SKILL")).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it("shows 'try ? to ask AI' hint in empty state", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeSearchResponse({ total: 0 }),
      });
      renderAndSearch("zzz");
      await waitFor(() => {
        expect(screen.getByText(/try/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  // ── ASK mode ────────────────────────────────────────────────────────────────

  describe("ASK mode (? prefix)", () => {
    function renderAndAsk(question = "? does Hammad know Kafka") {
      render(<><OpenButton /><CommandPalette /></>);
      fireEvent.click(screen.getByTestId("open"));
      fireEvent.change(screen.getByRole("textbox"), { target: { value: question } });
    }

    it("shows ASK badge in input row", () => {
      renderAndAsk();
      expect(screen.getByText("ASK")).toBeInTheDocument();
    });

    it("shows 'Press ↵ to ask' hint before submitting", () => {
      renderAndAsk();
      expect(screen.getByText(/press/i)).toBeInTheDocument();
    });

    it("does NOT show '↑↓ navigate' footer hint", () => {
      renderAndAsk();
      expect(screen.queryByText("navigate")).toBeNull();
    });

    it("shows '↵ ask' in footer", () => {
      renderAndAsk();
      expect(screen.getByText("ask")).toBeInTheDocument();
    });

    it("fires POST /chat/stream on Enter", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: "Hello" })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sources: [] })}\n\n`));
          controller.close();
        },
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      });
      global.fetch = mockFetch;

      renderAndAsk("? does Hammad know Kafka");
      const input = screen.getByRole("textbox");
      // Simulate Enter in the panel's onKeyDown
      fireEvent.keyDown(input.closest("[role=dialog]")!, { key: "Enter" });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/chat/stream"),
          expect.objectContaining({ method: "POST" }),
        );
      });
    });

    it("does not fire when question is blank (only ?)", () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;
      renderAndAsk("?");
      const input = screen.getByRole("textbox");
      fireEvent.keyDown(input.closest("[role=dialog]")!, { key: "Enter" });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── Recents ─────────────────────────────────────────────────────────────────

  describe("recents", () => {
    it("shows RECENT group header when localStorage has recents", () => {
      localStorage.setItem("palette_recents", JSON.stringify(["contact"]));
      render(<><OpenButton /><CommandPalette /></>);
      fireEvent.click(screen.getByTestId("open"));
      expect(screen.getByText("Recent")).toBeInTheDocument();
    });

    it("does NOT show RECENT group when localStorage is empty", () => {
      localStorage.clear();
      render(<><OpenButton /><CommandPalette /></>);
      fireEvent.click(screen.getByTestId("open"));
      expect(screen.queryByText("Recent")).toBeNull();
    });
  });

  // ── openPalette export ───────────────────────────────────────────────────────

  describe("openPalette()", () => {
    it("opens the palette when called", () => {
      render(<CommandPalette />);
      act(() => openPalette());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
