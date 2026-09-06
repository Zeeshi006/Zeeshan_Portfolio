"use client";
import { useState, useCallback, useRef } from "react";
import type { AIState } from "./constants";
import { TRANSITION_DURATION } from "./constants";

export interface AIStateController {
  state: AIState;
  prevState: AIState;
  isActive: boolean;
  navTarget: string | null;           // section id when navigating
  audioLevel: number;                  // 0-1 mic/speaker level
  activate: () => void;
  deactivate: () => void;
  setState: (s: AIState, navTarget?: string) => void;
  setAudioLevel: (v: number) => void;
  // Stubs — wired when ElevenLabs key exists
  startListening: () => void;
  stopListening: () => void;
}

export function useAIState(): AIStateController {
  const [state, setStateRaw] = useState<AIState>('dormant');
  const [prevState, setPrevState] = useState<AIState>('dormant');
  const [isActive, setIsActive] = useState(false);
  const [navTarget, setNavTarget] = useState<string | null>(null);
  const [audioLevel, setAudioLevelRaw] = useState(0);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setState = useCallback((next: AIState, target?: string) => {
    setPrevState((p) => p);
    if (target !== undefined) setNavTarget(target);
    if (transitionTimer.current) clearTimeout(transitionTimer.current);

    setStateRaw(next);

    // Auto-advance some states
    if (next === 'activating') {
      transitionTimer.current = setTimeout(() => {
        setStateRaw('listening');
      }, TRANSITION_DURATION.activating);
    }
    if (next === 'navigating' && target) {
      transitionTimer.current = setTimeout(() => {
        setStateRaw('focused');
      }, TRANSITION_DURATION.navigating);
    }
  }, []);

  const activate = useCallback(() => {
    setIsActive(true);
    setState('activating');
  }, [setState]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setNavTarget(null);
    setState('dormant');
  }, [setState]);

  const setAudioLevel = useCallback((v: number) => {
    setAudioLevelRaw(Math.max(0, Math.min(1, v)));
  }, []);

  // ElevenLabs stubs — replace with real implementation when key exists
  const startListening = useCallback(() => {
    setState('listening');
    // TODO: navigator.mediaDevices.getUserMedia → ElevenLabs STT stream
  }, [setState]);

  const stopListening = useCallback(() => {
    setState('thinking');
    // TODO: flush audio buffer → ElevenLabs → response → setState('speaking')
  }, [setState]);

  return {
    state,
    prevState,
    isActive,
    navTarget,
    audioLevel,
    activate,
    deactivate,
    setState,
    setAudioLevel,
    startListening,
    stopListening,
  };
}
