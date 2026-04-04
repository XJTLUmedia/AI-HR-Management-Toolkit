/**
 * MCP Tool: ats_communication
 *
 * Candidate communication management — email templates with variable interpolation,
 * communication history logging, and message searching.
 */

type TemplateCategory =
  | "application_received"
  | "interview_invite"
  | "rejection"
  | "offer"
  | "follow_up"
  | "onboarding"
  | "general";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string; // supports {{variable}} placeholders
  category: TemplateCategory;
  createdAt: string;
  updatedAt: string;
}

interface CommunicationLogEntry {
  id: string;
  candidateId: string;
  templateId?: string;
  channel: "email" | "sms" | "phone" | "in_app" | "other";
  subject: string;
  body: string;
  direction: "outbound" | "inbound";
  sentAt: string;
  status: "sent" | "delivered" | "failed" | "draft";
}

interface CandidateSlim {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  [k: string]: unknown;
}

type Action =
  | {
      type: "create_template";
      name: string;
      subject: string;
      body: string;
      category: TemplateCategory;
    }
  | { type: "list_templates"; category?: TemplateCategory }
  | { type: "get_template"; templateId: string }
  | { type: "update_template"; templateId: string; name?: string; subject?: string; body?: string; category?: TemplateCategory }
  | { type: "delete_template"; templateId: string }
  | {
      type: "preview";
      templateId: string;
      candidateId: string;
      variables?: Record<string, string>;
    }
  | {
      type: "send";
      templateId?: string;
      candidateId: string;
      channel?: string;
      subject?: string;
      body?: string;
      variables?: Record<string, string>;
    }
  | {
      type: "log";
      candidateId: string;
      channel: string;
      subject: string;
      body: string;
      direction?: string;
      status?: string;
    }
  | { type: "get_history"; candidateId: string; channel?: string; limit?: number }
  | { type: "search_history"; query: string; candidateId?: string; limit?: number }
  | { type: "stats"; candidateId?: string };

interface StateSlice {
  emailTemplates: Record<string, EmailTemplate>;
  communicationLog: CommunicationLogEntry[];
  candidates: Record<string, CandidateSlim>;
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
function nowISO() { return new Date().toISOString(); }

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

function interpolate(
  text: string,
  candidate: CandidateSlim | undefined,
  extra?: Record<string, string>
): string {
  const vars: Record<string, string> = {
    firstName: candidate?.firstName ?? "",
    lastName: candidate?.lastName ?? "",
    fullName: candidate ? `${candidate.firstName} ${candidate.lastName}` : "",
    email: candidate?.email ?? "",
    ...extra,
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function handleAction(input: { action: Action; state: StateSlice }) {
  const { action, state } = input;
  const templates = state.emailTemplates ?? {};
  const log = state.communicationLog ?? [];
  const candidates = state.candidates ?? {};

  switch (action.type) {
    case "create_template": {
      const id = genId("etmpl");
      const template: EmailTemplate = {
        id,
        name: action.name,
        subject: action.subject,
        body: action.body,
        category: action.category,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      return ok({ created: true, template, _storeOp: "upsert_email_template", _entity: template });
    }

    case "list_templates": {
      let list = Object.values(templates);
      if (action.category) list = list.filter((t) => t.category === action.category);
      return ok({
        templates: list.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          subject: t.subject,
          updatedAt: t.updatedAt,
        })),
        total: list.length,
      });
    }

    case "get_template": {
      const t = templates[action.templateId];
      if (!t) return err("Template not found");
      // Extract variables from body + subject
      const varRegex = /\{\{(\w+)\}\}/g;
      const variables = new Set<string>();
      let match: RegExpExecArray | null;
      const combined = t.subject + " " + t.body;
      while ((match = varRegex.exec(combined)) !== null) variables.add(match[1]);
      return ok({ template: t, variables: [...variables] });
    }

    case "update_template": {
      const t = templates[action.templateId];
      if (!t) return err("Template not found");
      const updated: EmailTemplate = {
        ...t,
        name: action.name ?? t.name,
        subject: action.subject ?? t.subject,
        body: action.body ?? t.body,
        category: action.category ?? t.category,
        updatedAt: nowISO(),
      };
      return ok({ updated: true, template: updated, _storeOp: "upsert_email_template", _entity: updated });
    }

    case "delete_template": {
      if (!templates[action.templateId]) return err("Template not found");
      return ok({
        deleted: true,
        templateId: action.templateId,
        _storeOp: "delete_email_template",
        _entity: { id: action.templateId },
      });
    }

    case "preview": {
      const t = templates[action.templateId];
      if (!t) return err("Template not found");
      const cand = candidates[action.candidateId];
      return ok({
        subject: interpolate(t.subject, cand, action.variables),
        body: interpolate(t.body, cand, action.variables),
        candidateEmail: cand?.email ?? "unknown",
      });
    }

    case "send": {
      const cand = candidates[action.candidateId];
      let subject = action.subject ?? "";
      let body = action.body ?? "";

      if (action.templateId) {
        const t = templates[action.templateId];
        if (!t) return err("Template not found");
        subject = interpolate(t.subject, cand, action.variables);
        body = interpolate(t.body, cand, action.variables);
      }

      if (!subject || !body) return err("Subject and body are required (directly or via template)");

      const entry: CommunicationLogEntry = {
        id: genId("comm"),
        candidateId: action.candidateId,
        templateId: action.templateId,
        channel: (action.channel as CommunicationLogEntry["channel"]) ?? "email",
        subject,
        body,
        direction: "outbound",
        sentAt: nowISO(),
        status: "sent",
      };
      return ok({
        sent: true,
        entry,
        to: cand?.email ?? action.candidateId,
        _storeOp: "append_communication_log",
        _entity: entry,
      });
    }

    case "log": {
      const entry: CommunicationLogEntry = {
        id: genId("comm"),
        candidateId: action.candidateId,
        channel: (action.channel as CommunicationLogEntry["channel"]) ?? "other",
        subject: action.subject,
        body: action.body,
        direction: (action.direction as CommunicationLogEntry["direction"]) ?? "inbound",
        sentAt: nowISO(),
        status: (action.status as CommunicationLogEntry["status"]) ?? "delivered",
      };
      return ok({ logged: true, entry, _storeOp: "append_communication_log", _entity: entry });
    }

    case "get_history": {
      let history = log.filter((e) => e.candidateId === action.candidateId);
      if (action.channel)
        history = history.filter((e) => e.channel === action.channel);
      history.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      if (action.limit) history = history.slice(0, action.limit);
      return ok({ history, total: history.length });
    }

    case "search_history": {
      const q = action.query.toLowerCase();
      let results = log.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q)
      );
      if (action.candidateId)
        results = results.filter((e) => e.candidateId === action.candidateId);
      results.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
      if (action.limit) results = results.slice(0, action.limit);
      return ok({ results, total: results.length });
    }

    case "stats": {
      let entries = log;
      if (action.candidateId) entries = entries.filter((e) => e.candidateId === action.candidateId);

      const byChannel: Record<string, number> = {};
      const byDirection: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const byTemplate: Record<string, number> = {};

      for (const e of entries) {
        byChannel[e.channel] = (byChannel[e.channel] || 0) + 1;
        byDirection[e.direction] = (byDirection[e.direction] || 0) + 1;
        byStatus[e.status] = (byStatus[e.status] || 0) + 1;
        if (e.templateId) byTemplate[e.templateId] = (byTemplate[e.templateId] || 0) + 1;
      }

      const uniqueCandidates = new Set(entries.map((e) => e.candidateId)).size;
      return ok({
        totalMessages: entries.length,
        uniqueCandidates,
        byChannel,
        byDirection,
        byStatus,
        topTemplates: Object.entries(byTemplate)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([id, count]) => ({
            templateId: id,
            templateName: templates[id]?.name ?? id,
            usageCount: count,
          })),
      });
    }

    default:
      return err(`Unknown action: ${(action as { type: string }).type}`);
  }
}

export const mcpAtsCommunicationTool = {
  name: "ats_communication",
  description:
    "Candidate communication management — create email templates with {{variable}} interpolation, " +
    "preview and send messages, log inbound/outbound communications, search history, and get " +
    "communication stats. Actions: create_template, list_templates, get_template, update_template, " +
    "delete_template, preview, send, log, get_history, search_history, stats.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "object" as const,
        description:
          'Action to perform. Set "type" to one of: create_template, list_templates, ' +
          "get_template, update_template, delete_template, preview, send, log, " +
          "get_history, search_history, stats.",
      },
      state: {
        type: "object" as const,
        description:
          "Current ATS state containing emailTemplates, communicationLog, and candidates.",
      },
    },
    required: ["action", "state"],
  },
  handler: (args: { action: Action; state: StateSlice }) => handleAction(args),
};
