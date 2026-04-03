/**
 * MCP Tool: ats_interview_feedback
 *
 * Submit, retrieve, update, and analyze interview feedback.
 */

interface FeedbackInput {
  rating: number; // 1-5
  strengths: string[];
  concerns: string[];
  recommendation: "strong-hire" | "hire" | "no-hire" | "strong-no-hire";
  notes?: string;
}

interface ExistingInterview {
  id: string;
  candidateId: string;
  candidateName?: string;
  jobId: string;
  jobTitle?: string;
  type: string;
  status: string;
  scheduledDate?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  duration?: number;
  interviewers: string[];
  feedback?: {
    rating: number;
    strengths: string[];
    concerns: string[];
    recommendation: string;
    notes: string;
    submittedAt: string;
  } | null;
  [key: string]: unknown;
}

type Action =
  | { type: "submit"; interviewId: string; feedback: FeedbackInput; submittedBy?: string }
  | { type: "get"; interviewId: string }
  | { type: "update"; interviewId: string; feedback: Partial<FeedbackInput> }
  | { type: "list_pending"; }
  | { type: "list_completed"; candidateId?: string }
  | { type: "analyze"; candidateId: string }
  | { type: "summary"; jobId?: string };

function nowISO(): string {
  return new Date().toISOString();
}

export const mcpAtsInterviewFeedbackTool = {
  name: "ats_interview_feedback",
  description:
    "Manage interview feedback in the ATS. Actions: submit (add feedback to completed interview), get (retrieve feedback for an interview), update (modify existing feedback), list_pending (interviews awaiting feedback), list_completed (interviews with feedback, optionally filtered by candidate), analyze (aggregate feedback for a candidate across all interviews), summary (hiring signal summary for a job or all jobs).",
  inputSchema: {
    type: "object" as const,
    properties: {
      interviews: {
        type: "object",
        description: "Current interviews record: Record<id, interviewObject>.",
      },
      action: {
        type: "object",
        description:
          'Action to perform. "type": "submit" | "get" | "update" | "list_pending" | "list_completed" | "analyze" | "summary".',
      },
    },
    required: ["interviews", "action"],
  },
  handler(args: {
    interviews: Record<string, ExistingInterview>;
    action: Action;
  }): { content: Array<{ type: "text"; text: string }> } {
    const { interviews, action } = args;

    switch (action.type) {
      case "submit": {
        const { interviewId, feedback, submittedBy } = action;
        const interview = interviews[interviewId];
        if (!interview) return r({ ok: false, error: `Interview ${interviewId} not found` });
        if (interview.feedback) return r({ ok: false, error: "Feedback already exists. Use 'update' to modify." });

        if (!feedback.rating || feedback.rating < 1 || feedback.rating > 5) {
          return r({ ok: false, error: "Rating must be 1-5" });
        }
        const validRecs = ["strong-hire", "hire", "no-hire", "strong-no-hire"];
        if (!validRecs.includes(feedback.recommendation)) {
          return r({ ok: false, error: `Recommendation must be one of: ${validRecs.join(", ")}` });
        }

        const feedbackObj = {
          rating: feedback.rating,
          strengths: feedback.strengths || [],
          concerns: feedback.concerns || [],
          recommendation: feedback.recommendation,
          notes: feedback.notes || "",
          submittedBy: submittedBy || "MCP User",
          submittedAt: nowISO(),
        };
        const updated = {
          ...interview,
          status: "completed",
          feedback: feedbackObj,
        };
        return r({
          ok: true,
          interview: updated,
          interviews: { ...interviews, [interviewId]: updated },
          message: `Feedback submitted for interview ${interviewId}: ${feedback.recommendation} (${feedback.rating}/5)`,
        });
      }

      case "get": {
        const { interviewId } = action;
        const interview = interviews[interviewId];
        if (!interview) return r({ ok: false, error: `Interview ${interviewId} not found` });
        if (!interview.feedback) return r({ ok: true, hasFeedback: false, message: "No feedback submitted yet" });
        return r({
          ok: true,
          hasFeedback: true,
          interviewId,
          type: interview.type,
          candidateId: interview.candidateId,
          feedback: interview.feedback,
        });
      }

      case "update": {
        const { interviewId, feedback } = action;
        const interview = interviews[interviewId];
        if (!interview) return r({ ok: false, error: `Interview ${interviewId} not found` });
        if (!interview.feedback) return r({ ok: false, error: "No existing feedback to update. Use 'submit' first." });

        if (feedback.rating !== undefined && (feedback.rating < 1 || feedback.rating > 5)) {
          return r({ ok: false, error: "Rating must be 1-5" });
        }

        const updatedFeedback = {
          ...interview.feedback,
          ...(feedback.rating !== undefined && { rating: feedback.rating }),
          ...(feedback.strengths !== undefined && { strengths: feedback.strengths }),
          ...(feedback.concerns !== undefined && { concerns: feedback.concerns }),
          ...(feedback.recommendation !== undefined && { recommendation: feedback.recommendation }),
          ...(feedback.notes !== undefined && { notes: feedback.notes }),
          updatedAt: nowISO(),
        };
        const updated = { ...interview, feedback: updatedFeedback };
        return r({
          ok: true,
          interview: updated,
          interviews: { ...interviews, [interviewId]: updated },
          message: "Feedback updated",
        });
      }

      case "list_pending": {
        const pending = Object.values(interviews).filter(
          (i) => (i.status === "completed" || i.status === "scheduled") && !i.feedback
        );
        return r({
          ok: true,
          total: pending.length,
          interviews: pending.map((i) => ({
            id: i.id,
            candidateId: i.candidateId,
            candidateName: i.candidateName,
            jobId: i.jobId,
            type: i.type,
            status: i.status,
            scheduledAt: i.scheduledDate || i.scheduledAt,
          })),
        });
      }

      case "list_completed": {
        let completed = Object.values(interviews).filter((i) => !!i.feedback);
        if (action.candidateId) {
          completed = completed.filter((i) => i.candidateId === action.candidateId);
        }
        completed.sort((a, b) =>
          (b.feedback?.submittedAt || "").localeCompare(a.feedback?.submittedAt || "")
        );
        return r({
          ok: true,
          total: completed.length,
          interviews: completed.map((i) => ({
            id: i.id,
            candidateId: i.candidateId,
            candidateName: i.candidateName,
            type: i.type,
            rating: i.feedback?.rating,
            recommendation: i.feedback?.recommendation,
            submittedAt: i.feedback?.submittedAt,
          })),
        });
      }

      case "analyze": {
        const { candidateId } = action;
        const candidateInterviews = Object.values(interviews).filter(
          (i) => i.candidateId === candidateId && !!i.feedback
        );
        if (candidateInterviews.length === 0) {
          return r({ ok: true, candidateId, message: "No interviews with feedback found for this candidate" });
        }

        const ratings = candidateInterviews.map((i) => i.feedback!.rating);
        const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

        const allStrengths: Record<string, number> = {};
        const allConcerns: Record<string, number> = {};
        const recommendations: Record<string, number> = {};

        for (const i of candidateInterviews) {
          const fb = i.feedback!;
          for (const s of fb.strengths) {
            allStrengths[s] = (allStrengths[s] || 0) + 1;
          }
          for (const c of fb.concerns) {
            allConcerns[c] = (allConcerns[c] || 0) + 1;
          }
          recommendations[fb.recommendation] = (recommendations[fb.recommendation] || 0) + 1;
        }

        const hireSignals = (recommendations["strong-hire"] || 0) + (recommendations["hire"] || 0);
        const noHireSignals = (recommendations["strong-no-hire"] || 0) + (recommendations["no-hire"] || 0);
        const total = candidateInterviews.length;

        let overallSignal: string;
        if (hireSignals === total) overallSignal = "Strong Hire";
        else if (hireSignals > noHireSignals) overallSignal = "Lean Hire";
        else if (noHireSignals > hireSignals) overallSignal = "Lean No-Hire";
        else overallSignal = "Mixed — needs discussion";

        return r({
          ok: true,
          candidateId,
          totalInterviews: total,
          averageRating: Math.round(avgRating * 10) / 10,
          overallSignal,
          recommendationBreakdown: recommendations,
          topStrengths: Object.entries(allStrengths)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([s, count]) => ({ strength: s, mentions: count })),
          topConcerns: Object.entries(allConcerns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([c, count]) => ({ concern: c, mentions: count })),
          interviews: candidateInterviews.map((i) => ({
            id: i.id,
            type: i.type,
            rating: i.feedback!.rating,
            recommendation: i.feedback!.recommendation,
          })),
        });
      }

      case "summary": {
        let list = Object.values(interviews).filter((i) => !!i.feedback);
        if (action.jobId) {
          list = list.filter((i) => i.jobId === action.jobId);
        }
        if (list.length === 0) {
          return r({ ok: true, message: "No interviews with feedback found" });
        }

        const ratings = list.map((i) => i.feedback!.rating);
        const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

        const byType: Record<string, number> = {};
        const byRec: Record<string, number> = {};
        for (const i of list) {
          byType[i.type] = (byType[i.type] || 0) + 1;
          byRec[i.feedback!.recommendation] = (byRec[i.feedback!.recommendation] || 0) + 1;
        }

        return r({
          ok: true,
          totalWithFeedback: list.length,
          averageRating: Math.round(avgRating * 10) / 10,
          byInterviewType: byType,
          byRecommendation: byRec,
          hireRate:
            Math.round(
              (((byRec["strong-hire"] || 0) + (byRec["hire"] || 0)) / list.length) * 100
            ) + "%",
        });
      }

      default:
        return r({ ok: false, error: `Unknown action type: ${(action as Action).type}` });
    }
  },
};

function r(data: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
