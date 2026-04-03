/**
 * ATS localStorage persistence layer.
 *
 * All data is stored under the `ats_` prefix in localStorage.
 * Provides typed CRUD operations for each entity type.
 */

import {
  type ATSState,
  type Candidate,
  type Job,
  type Interview,
  type Offer,
  INITIAL_ATS_STATE,
} from "./types";

const STORAGE_KEY = "ats_state";

// ──────────────────────────── Core I/O ───────────────────────────

export function loadState(): ATSState {
  if (typeof window === "undefined") return INITIAL_ATS_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_ATS_STATE;
    const parsed = JSON.parse(raw) as Partial<ATSState>;
    return {
      candidates: parsed.candidates ?? {},
      jobs: parsed.jobs ?? {},
      interviews: parsed.interviews ?? {},
      offers: parsed.offers ?? {},
      settings: parsed.settings ?? INITIAL_ATS_STATE.settings,
    };
  } catch {
    return INITIAL_ATS_STATE;
  }
}

export function saveState(state: ATSState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full — silently fail (data stays in memory)
  }
}

// ──────────────────────────── Candidate CRUD ─────────────────────

export function upsertCandidate(state: ATSState, candidate: Candidate): ATSState {
  return {
    ...state,
    candidates: { ...state.candidates, [candidate.id]: candidate },
  };
}

export function removeCandidate(state: ATSState, id: string): ATSState {
  const { [id]: _, ...rest } = state.candidates;
  // Also clean up from jobs
  const jobs = { ...state.jobs };
  for (const jobId of Object.keys(jobs)) {
    const job = jobs[jobId];
    if (job.candidateIds.includes(id)) {
      jobs[jobId] = {
        ...job,
        candidateIds: job.candidateIds.filter((cid) => cid !== id),
      };
    }
  }
  return { ...state, candidates: rest, jobs };
}

// ──────────────────────────── Job CRUD ───────────────────────────

export function upsertJob(state: ATSState, job: Job): ATSState {
  return {
    ...state,
    jobs: { ...state.jobs, [job.id]: job },
  };
}

export function removeJob(state: ATSState, id: string): ATSState {
  const { [id]: _, ...rest } = state.jobs;
  return { ...state, jobs: rest };
}

// ──────────────────────────── Interview CRUD ─────────────────────

export function upsertInterview(state: ATSState, interview: Interview): ATSState {
  return {
    ...state,
    interviews: { ...state.interviews, [interview.id]: interview },
  };
}

export function removeInterview(state: ATSState, id: string): ATSState {
  const { [id]: _, ...rest } = state.interviews;
  return { ...state, interviews: rest };
}

// ──────────────────────────── Offer CRUD ─────────────────────────

export function upsertOffer(state: ATSState, offer: Offer): ATSState {
  return {
    ...state,
    offers: { ...state.offers, [offer.id]: offer },
  };
}

export function removeOffer(state: ATSState, id: string): ATSState {
  const { [id]: _, ...rest } = state.offers;
  return { ...state, offers: rest };
}

// ──────────────────────────── Queries ────────────────────────────

export function getCandidatesForJob(state: ATSState, jobId: string): Candidate[] {
  return Object.values(state.candidates).filter((c) => c.jobId === jobId);
}

export function getCandidatesAtStage(state: ATSState, jobId: string, stageId: string): Candidate[] {
  return Object.values(state.candidates).filter(
    (c) => c.jobId === jobId && c.currentStage === stageId
  );
}

export function getInterviewsForCandidate(state: ATSState, candidateId: string): Interview[] {
  return Object.values(state.interviews).filter((i) => i.candidateId === candidateId);
}

export function getOffersForCandidate(state: ATSState, candidateId: string): Offer[] {
  return Object.values(state.offers).filter((o) => o.candidateId === candidateId);
}

export function getUpcomingInterviews(state: ATSState): Interview[] {
  const now = new Date().toISOString();
  return Object.values(state.interviews)
    .filter((i) => i.status === "scheduled" && i.scheduledAt > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

// ──────────────────────────── Dashboard Stats ────────────────────

export interface DashboardStats {
  totalCandidates: number;
  totalJobs: number;
  openJobs: number;
  upcomingInterviews: number;
  pendingOffers: number;
  hiredThisMonth: number;
  stageDistribution: Record<string, number>;
  recentActivities: Array<{ candidateName: string; activity: string; timestamp: string }>;
}

export function computeDashboardStats(state: ATSState): DashboardStats {
  const candidates = Object.values(state.candidates);
  const jobs = Object.values(state.jobs);
  const interviews = Object.values(state.interviews);
  const offers = Object.values(state.offers);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const stageDistribution: Record<string, number> = {};
  for (const c of candidates) {
    stageDistribution[c.currentStage] = (stageDistribution[c.currentStage] || 0) + 1;
  }

  const recentActivities = candidates
    .flatMap((c) =>
      c.activities.slice(-3).map((a) => ({
        candidateName: `${c.firstName} ${c.lastName}`,
        activity: a.description,
        timestamp: a.timestamp,
      }))
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

  return {
    totalCandidates: candidates.length,
    totalJobs: jobs.length,
    openJobs: jobs.filter((j) => j.status === "open").length,
    upcomingInterviews: interviews.filter(
      (i) => i.status === "scheduled" && i.scheduledAt > now.toISOString()
    ).length,
    pendingOffers: offers.filter((o) =>
      ["pending-approval", "sent"].includes(o.status)
    ).length,
    hiredThisMonth: candidates.filter(
      (c) => c.currentStage === "hired" && c.updatedAt >= monthStart
    ).length,
    stageDistribution,
    recentActivities,
  };
}

// ──────────────────────────── Export/Import ──────────────────────

export function exportATSData(state: ATSState): string {
  return JSON.stringify(state, null, 2);
}

export function importATSData(json: string): ATSState | null {
  try {
    const data = JSON.parse(json) as Partial<ATSState>;
    if (!data.candidates && !data.jobs) return null;
    return {
      candidates: data.candidates ?? {},
      jobs: data.jobs ?? {},
      interviews: data.interviews ?? {},
      offers: data.offers ?? {},
      settings: data.settings ?? INITIAL_ATS_STATE.settings,
    };
  } catch {
    return null;
  }
}
