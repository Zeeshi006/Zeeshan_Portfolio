"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { TRANSITION_DURATION } from "../constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIState =
  | "dormant"
  | "activating"
  | "listening"
  | "thinking"
  | "speaking"
  | "navigating"
  | "retrieving"
  | "focused";

interface SetStateOpts {
  navTarget?: string;
}

export interface AIStoreValue {
  state: AIState;
  prevState: AIState;
  isActive: boolean;
  audioLevel: number;
  navTarget: string | null;
  activate: () => void;
  deactivate: () => void;
  setState: (s: AIState, opts?: SetStateOpts) => void;
  setAudio: (n: number) => void;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface StoreState {
  state: AIState;
  prevState: AIState;
  isActive: boolean;
  audioLevel: number;
  navTarget: string | null;
}

type Action =
  | { type: "ACTIVATE" }
  | { type: "DEACTIVATE" }
  | { type: "SET_STATE"; payload: { state: AIState; navTarget?: string } }
  | { type: "SET_AUDIO"; payload: number };

const INITIAL: StoreState = {
  state: "dormant",
  prevState: "dormant",
  isActive: false,
  audioLevel: 0,
  navTarget: null,
};

function reducer(s: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "ACTIVATE":
      return { ...s, isActive: true, prevState: s.state, state: "activating" };

    case "DEACTIVATE":
      return {
        ...INITIAL,
        prevState: s.state,
      };

    case "SET_STATE":
      return {
        ...s,
        prevState: s.state,
        state: action.payload.state,
        navTarget:
          action.payload.navTarget !== undefined
            ? action.payload.navTarget
            : s.navTarget,
      };

    case "SET_AUDIO":
      return { ...s, audioLevel: Math.max(0, Math.min(1, action.payload)) };

    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AIStoreContext = createContext<AIStoreValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AIStoreProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(reducer, INITIAL);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (transitionTimer.current) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  }, []);

  const activate = useCallback(() => {
    clearTimer();
    dispatch({ type: "ACTIVATE" });
    // Auto-advance activating → listening
    transitionTimer.current = setTimeout(() => {
      dispatch({ type: "SET_STATE", payload: { state: "listening" } });
    }, TRANSITION_DURATION.activating);
  }, [clearTimer]);

  const deactivate = useCallback(() => {
    clearTimer();
    dispatch({ type: "DEACTIVATE" });
  }, [clearTimer]);

  const setState = useCallback(
    (s: AIState, opts?: SetStateOpts) => {
      clearTimer();
      dispatch({ type: "SET_STATE", payload: { state: s, ...(opts?.navTarget !== undefined && { navTarget: opts.navTarget }) } });

      // Auto-advance navigating → focused after the navigation duration
      if (s === "navigating") {
        transitionTimer.current = setTimeout(() => {
          dispatch({ type: "SET_STATE", payload: { state: "focused" } });
        }, TRANSITION_DURATION.navigating);
      }
    },
    [clearTimer]
  );

  const setAudio = useCallback((n: number) => {
    dispatch({ type: "SET_AUDIO", payload: n });
  }, []);

  const value: AIStoreValue = {
    state: store.state,
    prevState: store.prevState,
    isActive: store.isActive,
    audioLevel: store.audioLevel,
    navTarget: store.navTarget,
    activate,
    deactivate,
    setState,
    setAudio,
  };

  return (
    <AIStoreContext.Provider value={value}>{children}</AIStoreContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAIStore(): AIStoreValue {
  const ctx = useContext(AIStoreContext);
  if (!ctx) {
    throw new Error("useAIStore must be used inside <AIStoreProvider>");
  }
  return ctx;
}
