/**
 * MCP Tool: ats_compliance
 *
 * Enterprise compliance: audit trail, EEO/EEOC reporting, GDPR data erasure & export,
 * data retention policies. All algorithmic — no AI calls.
 */

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface EEORecord {
  candidateId: string;
  gender?: string;
  ethnicity?: string;
  veteranStatus?: string;
  disabilityStatus?: string;
  collectedAt: string;
}

interface CandidateSlice {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentStage: string;
  jobId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface RetentionPolicy {
  entityType: string;
  retentionDays: number;
  autoDelete: boolean;
}

interface ComplianceSettings {
  gdprEnabled: boolean;
  eeoTrackingEnabled: boolean;
  retentionPolicies: RetentionPolicy[];
  anonymizeRejectedAfterDays: number;
}

type Action =
  | { type: "query_audit"; filters?: { action?: string; entityType?: string; entityId?: string; actor?: string; from?: string; to?: string }; limit?: number }
  | { type: "eeo_report"; jobId?: string }
  | { type: "eeo_record"; candidateId: string; data: Partial<EEORecord> }
  | { type: "gdpr_export"; candidateId: string }
  | { type: "gdpr_erase"; candidateId: string; confirm: boolean }
  | { type: "retention_check" }
  | { type: "update_settings"; settings: Partial<ComplianceSettings> }
  | { type: "get_settings" };

interface StateSlice {
  candidates: Record<string, CandidateSlice>;
  auditLog?: AuditEntry[];
  eeoRecords?: Record<string, EEORecord>;
  complianceSettings?: ComplianceSettings;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: ComplianceSettings = {
  gdprEnabled: false,
  eeoTrackingEnabled: false,
  retentionPolicies: [
    { entityType: "candidate", retentionDays: 730, autoDelete: false },
  ],
  anonymizeRejectedAfterDays: 180,
};

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

function handleAction(input: { action: Action; state: StateSlice }) {
  const { action, state } = input;
  const auditLog = state.auditLog ?? [];
  const eeoRecords = state.eeoRecords ?? {};
  const settings = state.complianceSettings ?? DEFAULT_SETTINGS;
  const candidates = Object.values(state.candidates ?? {});

  switch (action.type) {
    case "query_audit": {
      let filtered = [...auditLog];
      const f = action.filters;
      if (f?.action) filtered = filtered.filter((e) => e.action === f.action);
      if (f?.entityType) filtered = filtered.filter((e) => e.entityType === f.entityType);
      if (f?.entityId) filtered = filtered.filter((e) => e.entityId === f.entityId);
      if (f?.actor) filtered = filtered.filter((e) => e.actor === f.actor);
      if (f?.from) filtered = filtered.filter((e) => e.timestamp >= f.from!);
      if (f?.to) filtered = filtered.filter((e) => e.timestamp <= f.to!);
      filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const limit = action.limit ?? 50;
      return ok({
        total: filtered.length,
        returned: Math.min(filtered.length, limit),
        entries: filtered.slice(0, limit),
      });
    }

    case "eeo_report": {
      const relevantCandidates = action.jobId
        ? candidates.filter((c) => c.jobId === action.jobId)
        : candidates;
      const relevantIds = new Set(relevantCandidates.map((c) => c.id));
      const records = Object.values(eeoRecords).filter((r) => relevantIds.has(r.candidateId));
      const genderDist: Record<string, number> = {};
      const ethnicityDist: Record<string, number> = {};
      const veteranDist: Record<string, number> = {};
      const disabilityDist: Record<string, number> = {};
      for (const r of records) {
        if (r.gender) genderDist[r.gender] = (genderDist[r.gender] || 0) + 1;
        if (r.ethnicity) ethnicityDist[r.ethnicity] = (ethnicityDist[r.ethnicity] || 0) + 1;
        if (r.veteranStatus) veteranDist[r.veteranStatus] = (veteranDist[r.veteranStatus] || 0) + 1;
        if (r.disabilityStatus) disabilityDist[r.disabilityStatus] = (disabilityDist[r.disabilityStatus] || 0) + 1;
      }
      // Stage distribution by demographic
      const stageByGender: Record<string, Record<string, number>> = {};
      for (const r of records) {
        const c = state.candidates[r.candidateId];
        if (!c || !r.gender) continue;
        if (!stageByGender[r.gender]) stageByGender[r.gender] = {};
        stageByGender[r.gender][c.currentStage] = (stageByGender[r.gender][c.currentStage] || 0) + 1;
      }
      return ok({
        totalCandidates: relevantCandidates.length,
        recordsCollected: records.length,
        collectionRate: relevantCandidates.length > 0
          ? `${Math.round((records.length / relevantCandidates.length) * 100)}%`
          : "N/A",
        gender: genderDist,
        ethnicity: ethnicityDist,
        veteranStatus: veteranDist,
        disabilityStatus: disabilityDist,
        pipelineByGender: stageByGender,
        disclaimer: "This data is self-reported and voluntary. Use for aggregate reporting only.",
      });
    }

    case "eeo_record": {
      if (!state.candidates[action.candidateId]) return err("Candidate not found");
      const existing = eeoRecords[action.candidateId];
      const record: EEORecord = {
        candidateId: action.candidateId,
        gender: action.data.gender ?? existing?.gender,
        ethnicity: action.data.ethnicity ?? existing?.ethnicity,
        veteranStatus: action.data.veteranStatus ?? existing?.veteranStatus,
        disabilityStatus: action.data.disabilityStatus ?? existing?.disabilityStatus,
        collectedAt: new Date().toISOString(),
      };
      return ok({ saved: true, record, _storeOp: "upsert_eeo", _entity: record });
    }

    case "gdpr_export": {
      const c = state.candidates[action.candidateId];
      if (!c) return err("Candidate not found");
      const eeo = eeoRecords[action.candidateId];
      const relatedAudit = auditLog.filter((e) => e.entityId === action.candidateId);
      return ok({
        personalData: {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          currentStage: c.currentStage,
          tags: c.tags,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        },
        eeoData: eeo ?? null,
        auditTrail: relatedAudit.slice(0, 100),
        exportedAt: new Date().toISOString(),
        format: "GDPR Article 15 — Subject Access Request",
      });
    }

    case "gdpr_erase": {
      if (!action.confirm) return err("Must set confirm: true to execute GDPR erasure");
      const c = state.candidates[action.candidateId];
      if (!c) return err("Candidate not found");
      return ok({
        erased: true,
        candidateId: action.candidateId,
        candidateName: `${c.firstName} ${c.lastName}`,
        erasedAt: new Date().toISOString(),
        note: "Candidate personal data has been anonymized. Aggregate statistics are retained.",
        _storeOp: "gdpr_erase",
        _entity: { candidateId: action.candidateId },
      });
    }

    case "retention_check": {
      const now = Date.now();
      const flagged: Array<{ entityType: string; id: string; name: string; daysOld: number; policy: number }> = [];
      for (const policy of settings.retentionPolicies) {
        if (policy.entityType === "candidate") {
          for (const c of candidates) {
            const age = Math.floor((now - new Date(c.createdAt).getTime()) / 86400000);
            if (age > policy.retentionDays) {
              flagged.push({
                entityType: "candidate",
                id: c.id,
                name: `${c.firstName} ${c.lastName}`,
                daysOld: age,
                policy: policy.retentionDays,
              });
            }
          }
        }
      }
      return ok({
        policies: settings.retentionPolicies,
        flaggedForReview: flagged,
        totalFlagged: flagged.length,
        checkedAt: new Date().toISOString(),
      });
    }

    case "update_settings": {
      const merged = { ...settings, ...action.settings };
      return ok({ updated: true, settings: merged, _storeOp: "update_compliance_settings", _entity: merged });
    }

    case "get_settings": {
      return ok({ settings });
    }

    default:
      return err(`Unknown action: ${(action as { type: string }).type}`);
  }
}

export const mcpAtsComplianceTool = {
  name: "ats_compliance",
  description:
    "Enterprise compliance toolkit: audit trail queries, EEO/EEOC diversity reporting, " +
    "GDPR data export & erasure (right to be forgotten), data retention policy checks. " +
    "Actions: query_audit, eeo_report, eeo_record, gdpr_export, gdpr_erase, retention_check, " +
    "update_settings, get_settings.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "object" as const,
        description:
          'Action to perform. Set "type" to one of: query_audit, eeo_report, eeo_record, ' +
          "gdpr_export, gdpr_erase, retention_check, update_settings, get_settings.",
      },
      state: {
        type: "object" as const,
        description: "Current ATS state containing candidates, auditLog, eeoRecords, complianceSettings.",
      },
    },
    required: ["action", "state"],
  },
  handler: (args: { action: Action; state: StateSlice }) => handleAction(args),
};
