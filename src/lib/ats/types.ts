/**
 * ATS (Applicant Tracking System) — Core data types.
 *
 * All entities use string IDs (nanoid-style) and ISO-8601 timestamps.
 * Persistence: localStorage. No backend required.
 */

import type { AssessmentCriteria } from "@/lib/schemas/criteria";
import type { AssessmentResult } from "@/lib/analysis/criteria-scorer";

// ──────────────────────────── Pipeline ────────────────────────────

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string; // tailwind-compatible hex
}

export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: "applied", name: "Applied", order: 0, color: "#6366f1" },
  { id: "screening", name: "Screening", order: 1, color: "#8b5cf6" },
  { id: "phone-screen", name: "Phone Screen", order: 2, color: "#a855f7" },
  { id: "interview", name: "Interview", order: 3, color: "#06b6d4" },
  { id: "final-round", name: "Final Round", order: 4, color: "#0ea5e9" },
  { id: "offer", name: "Offer", order: 5, color: "#10b981" },
  { id: "hired", name: "Hired", order: 6, color: "#22c55e" },
  { id: "rejected", name: "Rejected", order: 7, color: "#ef4444" },
];

// ──────────────────────────── Activity / Notes ────────────────────

export type ActivityType =
  | "stage-change"
  | "note-added"
  | "interview-scheduled"
  | "interview-completed"
  | "offer-created"
  | "offer-updated"
  | "assessment-run"
  | "resume-parsed"
  | "feedback-submitted"
  | "candidate-created";

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: string; // ISO-8601
  metadata?: Record<string, unknown>;
}

export interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

// ──────────────────────────── Candidate ───────────────────────────

export interface CandidateResumeData {
  rawText: string;
  structured: Record<string, unknown>;
  pipeline?: Record<string, unknown>;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  currentStage: string; // PipelineStage.id
  jobId: string;
  source?: string; // "upload" | "referral" | "linkedin" etc.
  tags: string[];
  resumeData?: CandidateResumeData;
  assessmentResult?: AssessmentResult;
  notes: Note[];
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────── Job ─────────────────────────────────

export type JobStatus = "draft" | "open" | "paused" | "closed";

export interface Job {
  id: string;
  title: string;
  department: string;
  location?: string;
  type?: "full-time" | "part-time" | "contract" | "internship";
  description: string;
  requirements: string[];
  status: JobStatus;
  pipeline: PipelineStage[];
  criteria?: AssessmentCriteria;
  candidateIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────── Interview ───────────────────────────

export type InterviewType =
  | "phone"
  | "video"
  | "onsite"
  | "technical"
  | "behavioral"
  | "panel";

export type InterviewStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no-show";

export interface InterviewFeedback {
  rating: number; // 1-5
  strengths: string[];
  concerns: string[];
  recommendation:
    | "strong-hire"
    | "hire"
    | "no-hire"
    | "strong-no-hire";
  notes: string;
  submittedAt: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  jobId: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string; // ISO-8601
  duration: number; // minutes
  interviewers: string[];
  location?: string;
  meetingLink?: string;
  notes?: string;
  feedback?: InterviewFeedback;
  createdAt: string;
}

// ──────────────────────────── Offer ──────────────────────────────

export type OfferStatus =
  | "draft"
  | "pending-approval"
  | "approved"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn";

export interface OfferApproval {
  approver: string;
  status: "pending" | "approved" | "rejected";
  comment?: string;
  respondedAt?: string;
}

export interface Offer {
  id: string;
  candidateId: string;
  jobId: string;
  status: OfferStatus;
  salary: {
    base: number;
    currency: string;
    period: "annual" | "monthly";
  };
  bonus?: number;
  equity?: string;
  benefits: string[];
  startDate: string;
  expiresAt: string;
  notes?: string;
  approvals: OfferApproval[];
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────── ATS State ──────────────────────────

export interface ATSState {
  candidates: Record<string, Candidate>;
  jobs: Record<string, Job>;
  interviews: Record<string, Interview>;
  offers: Record<string, Offer>;
  settings: {
    defaultPipeline: PipelineStage[];
  };
}

export const INITIAL_ATS_STATE: ATSState = {
  candidates: {},
  jobs: {},
  interviews: {},
  offers: {},
  settings: {
    defaultPipeline: DEFAULT_PIPELINE_STAGES,
  },
};

// ──────────────────────────── Navigation ─────────────────────────

export type ATSView =
  | "dashboard"
  | "candidates"
  | "jobs"
  | "interviews"
  | "offers"
  | "settings"
  | "parser";

// ──────────────────────────── Helpers ────────────────────────────

let _counter = 0;
export function generateId(): string {
  _counter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}-${_counter}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
