/**
 * ATS React Context — global state provider with auto-persist to localStorage.
 */

"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
  type Dispatch,
} from "react";
import {
  type ATSState,
  type ATSView,
  type Candidate,
  type Job,
  type Interview,
  type Offer,
  type Activity,
  type Note,
  INITIAL_ATS_STATE,
  generateId,
  nowISO,
} from "./types";
import {
  loadState,
  saveState,
  upsertCandidate,
  removeCandidate as removeC,
  upsertJob,
  removeJob as removeJ,
  upsertInterview,
  removeInterview as removeI,
  upsertOffer,
  removeOffer as removeO,
} from "./store";
import { generateDemoData } from "./demo-data";

// ──────────────────────────── Actions ────────────────────────────

type ATSAction =
  | { type: "LOAD"; state: ATSState }
  | { type: "ADD_CANDIDATE"; candidate: Candidate }
  | { type: "UPDATE_CANDIDATE"; candidate: Candidate }
  | { type: "DELETE_CANDIDATE"; id: string }
  | { type: "MOVE_CANDIDATE"; id: string; stageId: string }
  | { type: "ADD_NOTE"; candidateId: string; note: Note }
  | { type: "UPDATE_NOTE"; candidateId: string; noteId: string; content: string }
  | { type: "DELETE_NOTE"; candidateId: string; noteId: string }
  | { type: "ADD_ACTIVITY"; candidateId: string; activity: Activity }
  | { type: "ADD_JOB"; job: Job }
  | { type: "UPDATE_JOB"; job: Job }
  | { type: "DELETE_JOB"; id: string }
  | { type: "ADD_INTERVIEW"; interview: Interview }
  | { type: "UPDATE_INTERVIEW"; interview: Interview }
  | { type: "DELETE_INTERVIEW"; id: string }
  | { type: "ADD_OFFER"; offer: Offer }
  | { type: "UPDATE_OFFER"; offer: Offer }
  | { type: "DELETE_OFFER"; id: string }
  | { type: "IMPORT_STATE"; state: ATSState };

function atsReducer(state: ATSState, action: ATSAction): ATSState {
  switch (action.type) {
    case "LOAD":
      return action.state;
    case "IMPORT_STATE":
      return action.state;

    case "ADD_CANDIDATE":
    case "UPDATE_CANDIDATE":
      return upsertCandidate(state, action.candidate);
    case "DELETE_CANDIDATE":
      return removeC(state, action.id);
    case "MOVE_CANDIDATE": {
      const c = state.candidates[action.id];
      if (!c) return state;
      const activity: Activity = {
        id: generateId(),
        type: "stage-change",
        description: `Moved to ${action.stageId}`,
        timestamp: nowISO(),
        metadata: { from: c.currentStage, to: action.stageId },
      };
      return upsertCandidate(state, {
        ...c,
        currentStage: action.stageId,
        updatedAt: nowISO(),
        activities: [...c.activities, activity],
      });
    }
    case "ADD_NOTE": {
      const c = state.candidates[action.candidateId];
      if (!c) return state;
      const noteActivity: Activity = {
        id: generateId(),
        type: "note-added",
        description: "Note added",
        timestamp: nowISO(),
      };
      return upsertCandidate(state, {
        ...c,
        notes: [...c.notes, action.note],
        activities: [...c.activities, noteActivity],
        updatedAt: nowISO(),
      });
    }
    case "UPDATE_NOTE": {
      const c = state.candidates[action.candidateId];
      if (!c) return state;
      return upsertCandidate(state, {
        ...c,
        notes: c.notes.map((n) =>
          n.id === action.noteId ? { ...n, content: action.content } : n
        ),
        updatedAt: nowISO(),
      });
    }
    case "DELETE_NOTE": {
      const c = state.candidates[action.candidateId];
      if (!c) return state;
      return upsertCandidate(state, {
        ...c,
        notes: c.notes.filter((n) => n.id !== action.noteId),
        updatedAt: nowISO(),
      });
    }
    case "ADD_ACTIVITY": {
      const c = state.candidates[action.candidateId];
      if (!c) return state;
      return upsertCandidate(state, {
        ...c,
        activities: [...c.activities, action.activity],
        updatedAt: nowISO(),
      });
    }

    case "ADD_JOB":
    case "UPDATE_JOB":
      return upsertJob(state, action.job);
    case "DELETE_JOB":
      return removeJ(state, action.id);

    case "ADD_INTERVIEW":
    case "UPDATE_INTERVIEW":
      return upsertInterview(state, action.interview);
    case "DELETE_INTERVIEW":
      return removeI(state, action.id);

    case "ADD_OFFER":
    case "UPDATE_OFFER":
      return upsertOffer(state, action.offer);
    case "DELETE_OFFER":
      return removeO(state, action.id);

    default:
      return state;
  }
}

// ──────────────────────────── Context ────────────────────────────

interface ATSContextValue {
  state: ATSState;
  dispatch: Dispatch<ATSAction>;
  /* Current navigation view */
  currentView: ATSView;
  setCurrentView: (view: ATSView) => void;
  /* Selected entity IDs for detail views */
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  selectedCandidateId: string | null;
  setSelectedCandidateId: (id: string | null) => void;
}

const ATSContext = createContext<ATSContextValue | null>(null);

export function ATSProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(atsReducer, INITIAL_ATS_STATE);
  const [currentView, setCurrentView] = useReducer(
    (_: ATSView, v: ATSView) => v,
    "dashboard" as ATSView
  );
  const [selectedJobId, setSelectedJobId] = useReducer(
    (_: string | null, v: string | null) => v,
    null as string | null
  );
  const [selectedCandidateId, setSelectedCandidateId] = useReducer(
    (_: string | null, v: string | null) => v,
    null as string | null
  );

  // Load from localStorage on mount — auto-populate demo data on first visit
  useEffect(() => {
    const loaded = loadState();
    const isEmpty =
      Object.keys(loaded.candidates).length === 0 &&
      Object.keys(loaded.jobs).length === 0;
    if (isEmpty) {
      const demo = generateDemoData();
      dispatch({ type: "LOAD", state: demo });
    } else {
      dispatch({ type: "LOAD", state: loaded });
    }
  }, []);

  // Auto-save on every state change (debounced by React batching)
  useEffect(() => {
    saveState(state);
  }, [state]);

  return (
    <ATSContext.Provider
      value={{
        state,
        dispatch,
        currentView,
        setCurrentView,
        selectedJobId,
        setSelectedJobId,
        selectedCandidateId,
        setSelectedCandidateId,
      }}
    >
      {children}
    </ATSContext.Provider>
  );
}

export function useATS(): ATSContextValue {
  const ctx = useContext(ATSContext);
  if (!ctx) throw new Error("useATS must be used within <ATSProvider>");
  return ctx;
}

// ──────────────────────────── Convenience hooks ──────────────────

export function useATSCandidates() {
  const { state } = useATS();
  return useCallback(
    () => Object.values(state.candidates),
    [state.candidates]
  )();
}

export function useATSJobs() {
  const { state } = useATS();
  return useCallback(
    () => Object.values(state.jobs),
    [state.jobs]
  )();
}
