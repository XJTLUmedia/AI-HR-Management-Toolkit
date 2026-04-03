/**
 * MCP Tool: ATS Manage Offers
 * Create, validate, and manage offer lifecycle. Pure-data transform.
 */

interface OfferInput {
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  salary: {
    base: number;
    currency: string;
    period: "annual" | "monthly" | "hourly";
    bonus?: number;
    equity?: string;
  };
  benefits?: string[];
  startDate: string;
  expirationDate: string;
  notes?: string;
}

interface ExistingOffer {
  id: string;
  candidateId: string;
  jobId: string;
  status: string;
  salary: { base: number; currency: string; period: string };
}

type Action =
  | { type: "create"; offer: OfferInput }
  | { type: "update_status"; offerId: string; newStatus: string; comment?: string }
  | { type: "delete"; offerId: string }
  | { type: "list"; filters?: { candidateId?: string; jobId?: string; status?: string } }
  | { type: "compare"; offers: ExistingOffer[] }
  | { type: "validate"; offer: OfferInput };

export const mcpAtsManageOffersTool = {
  name: "ats_manage_offers",
  description:
    "Manage offers in the ATS. Actions: create (validate & structure), update_status (draft→pending-approval→approved→sent→accepted/declined), delete (remove offer), list (all offers with optional filters), compare (side-by-side offer comparison), validate (check for issues). Returns structured offer data.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "object",
        description: `Action to perform:
- { type: "create", offer: { candidateId, candidateName, jobId, jobTitle, salary: { base, currency, period, bonus?, equity? }, benefits?, startDate, expirationDate, notes? } }
- { type: "update_status", offerId, newStatus: "pending-approval"|"approved"|"sent"|"accepted"|"declined"|"withdrawn"|"negotiating", comment? }
- { type: "delete", offerId }
- { type: "list", filters?: { candidateId?, jobId?, status? } }
- { type: "compare", offers: [existing offer objects] }
- { type: "validate", offer: { same as create } }`,
      },
      existingOffers: {
        type: "object",
        description: "Current offers record (id → offer object). Pass {} for a fresh start.",
      },
    },
    required: ["action"],
  },

  handler(args: { action: Action; existingOffers?: Record<string, Record<string, unknown>> }) {
    const offers = args.existingOffers ? { ...args.existingOffers } : {};
    const now = new Date().toISOString();

    function validateOffer(offer: OfferInput): string[] {
      const errors: string[] = [];
      if (!offer.candidateId) errors.push("candidateId is required");
      if (!offer.jobId) errors.push("jobId is required");
      if (!offer.salary?.base || offer.salary.base <= 0) errors.push("salary.base must be > 0");
      if (!offer.salary?.currency) errors.push("salary.currency is required");
      if (!offer.startDate) errors.push("startDate is required");
      if (!offer.expirationDate) errors.push("expirationDate is required");
      const start = new Date(offer.startDate).getTime();
      const exp = new Date(offer.expirationDate).getTime();
      if (start && exp && exp < Date.now()) errors.push("expirationDate is in the past");
      if (start && exp && start < exp) { /* not an error, just a common validation */ }
      return errors;
    }

    const { action } = args;

    switch (action.type) {
      case "create": {
        const errors = validateOffer(action.offer);
        if (errors.length) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, errors }, null, 2) }] };
        }

        const id = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const o = {
          id,
          candidateId: action.offer.candidateId,
          candidateName: action.offer.candidateName,
          jobId: action.offer.jobId,
          jobTitle: action.offer.jobTitle,
          status: "draft",
          salary: {
            base: action.offer.salary.base,
            currency: action.offer.salary.currency,
            period: action.offer.salary.period,
            bonus: action.offer.salary.bonus || 0,
            equity: action.offer.salary.equity || "",
          },
          benefits: action.offer.benefits || [],
          startDate: action.offer.startDate,
          expirationDate: action.offer.expirationDate,
          notes: action.offer.notes || "",
          approvals: [],
          createdAt: now,
          updatedAt: now,
        };
        offers[id] = o;
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "create", offerId: id, offer: o }, null, 2) }],
        };
      }

      case "update_status": {
        const o = offers[action.offerId];
        if (!o) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: `Offer ${action.offerId} not found` }) }] };
        }

        const VALID_TRANSITIONS: Record<string, string[]> = {
          draft: ["pending-approval", "withdrawn"],
          "pending-approval": ["approved", "withdrawn"],
          approved: ["sent", "withdrawn"],
          sent: ["accepted", "declined", "negotiating", "withdrawn"],
          negotiating: ["sent", "withdrawn", "declined"],
          accepted: [],
          declined: [],
          withdrawn: [],
        };

        const currentStatus = (o.status as string) || "draft";
        const allowed = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(action.newStatus)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              ok: false,
              error: `Cannot transition from "${currentStatus}" to "${action.newStatus}". Allowed: ${allowed.join(", ") || "none (terminal state)"}`,
            }, null, 2) }],
          };
        }

        o.status = action.newStatus;
        o.updatedAt = now;
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "update_status", offerId: action.offerId, from: currentStatus, to: action.newStatus }, null, 2) }],
        };
      }

      case "delete": {
        const od = offers[action.offerId];
        if (!od) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: `Offer ${action.offerId} not found` }) }] };
        }
        delete offers[action.offerId];
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "delete", offerId: action.offerId, message: `Offer ${action.offerId} deleted`, offers }, null, 2) }],
        };
      }

      case "list": {
        let list = Object.entries(offers).map(([id, o]) => ({ id, ...o }));
        const f = action.filters;
        if (f?.candidateId) list = list.filter((o) => (o as Record<string, unknown>).candidateId === f.candidateId);
        if (f?.jobId) list = list.filter((o) => (o as Record<string, unknown>).jobId === f.jobId);
        if (f?.status) list = list.filter((o) => (o as Record<string, unknown>).status === f.status);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action: "list", total: list.length, offers: list }, null, 2) }],
        };
      }

      case "compare": {
        if (!action.offers?.length) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "No offers to compare" }) }] };
        }

        const normalize = (o: ExistingOffer) => {
          let annual = o.salary.base;
          if (o.salary.period === "monthly") annual *= 12;
          if (o.salary.period === "hourly") annual *= 2080; // ~40h/week * 52
          return annual;
        };

        const compared = action.offers.map((o) => ({
          id: o.id,
          candidateId: o.candidateId,
          jobId: o.jobId,
          status: o.status,
          originalBase: o.salary.base,
          currency: o.salary.currency,
          period: o.salary.period,
          annualizedBase: normalize(o),
        }));

        compared.sort((a, b) => b.annualizedBase - a.annualizedBase);

        const avg = compared.reduce((s, c) => s + c.annualizedBase, 0) / compared.length;
        const min = compared[compared.length - 1];
        const max = compared[0];

        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            ok: true,
            action: "compare",
            count: compared.length,
            averageAnnualBase: Math.round(avg),
            highest: { id: max.id, annualBase: max.annualizedBase },
            lowest: { id: min.id, annualBase: min.annualizedBase },
            rankedOffers: compared,
          }, null, 2) }],
        };
      }

      case "validate": {
        const errors = validateOffer(action.offer);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({
            ok: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            message: errors.length === 0 ? "Offer data is valid" : `${errors.length} validation error(s)`,
          }, null, 2) }],
        };
      }

      default:
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error: "Unknown action type" }) }] };
    }
  },
};
