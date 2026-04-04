/**
 * MCP Tool: ats_talent_pool
 *
 * Manage passive candidate talent pools / CRM.
 * Create pools, add/remove candidates, search, tag, and get pool analytics.
 */

interface PoolCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  tags: string[];
  currentStage: string;
  [key: string]: unknown;
}

interface TalentPool {
  id: string;
  name: string;
  description: string;
  tags: string[];
  candidateIds: string[];
  source?: string;
  createdAt: string;
  updatedAt: string;
}

type Action =
  | { type: "create"; name: string; description?: string; tags?: string[]; source?: string }
  | { type: "update"; poolId: string; name?: string; description?: string; tags?: string[] }
  | { type: "delete"; poolId: string }
  | { type: "list" }
  | { type: "get"; poolId: string }
  | { type: "add_candidates"; poolId: string; candidateIds: string[] }
  | { type: "remove_candidates"; poolId: string; candidateIds: string[] }
  | { type: "search"; query: string; tags?: string[] }
  | { type: "analytics"; poolId?: string };

interface StateSlice {
  talentPools: Record<string, TalentPool>;
  candidates: Record<string, PoolCandidate>;
}

function genId() {
  return `pool_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
function nowISO() { return new Date().toISOString(); }

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true as const };
}

function handleAction(input: { action: Action; state: StateSlice }) {
  const { action, state } = input;
  const pools = state.talentPools ?? {};
  const candidates = state.candidates ?? {};

  switch (action.type) {
    case "create": {
      const id = genId();
      const pool: TalentPool = {
        id,
        name: action.name,
        description: action.description ?? "",
        tags: action.tags ?? [],
        candidateIds: [],
        source: action.source,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      return ok({ created: true, pool, _storeOp: "upsert_talent_pool", _entity: pool });
    }

    case "update": {
      const pool = pools[action.poolId];
      if (!pool) return err("Pool not found");
      const updated: TalentPool = {
        ...pool,
        name: action.name ?? pool.name,
        description: action.description ?? pool.description,
        tags: action.tags ?? pool.tags,
        updatedAt: nowISO(),
      };
      return ok({ updated: true, pool: updated, _storeOp: "upsert_talent_pool", _entity: updated });
    }

    case "delete": {
      if (!pools[action.poolId]) return err("Pool not found");
      return ok({ deleted: true, poolId: action.poolId, _storeOp: "delete_talent_pool", _entity: { id: action.poolId } });
    }

    case "list": {
      const list = Object.values(pools).map((p) => ({
        ...p,
        candidateCount: p.candidateIds.length,
      }));
      return ok({ pools: list, total: list.length });
    }

    case "get": {
      const pool = pools[action.poolId];
      if (!pool) return err("Pool not found");
      const poolCandidates = pool.candidateIds
        .map((id) => candidates[id])
        .filter(Boolean)
        .map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          tags: c.tags,
          stage: c.currentStage,
        }));
      return ok({ pool, candidates: poolCandidates });
    }

    case "add_candidates": {
      const pool = pools[action.poolId];
      if (!pool) return err("Pool not found");
      const existing = new Set(pool.candidateIds);
      const added: string[] = [];
      for (const id of action.candidateIds) {
        if (!existing.has(id) && candidates[id]) {
          existing.add(id);
          added.push(id);
        }
      }
      const updated: TalentPool = {
        ...pool,
        candidateIds: Array.from(existing),
        updatedAt: nowISO(),
      };
      return ok({ added: added.length, pool: updated, _storeOp: "upsert_talent_pool", _entity: updated });
    }

    case "remove_candidates": {
      const pool = pools[action.poolId];
      if (!pool) return err("Pool not found");
      const toRemove = new Set(action.candidateIds);
      const updated: TalentPool = {
        ...pool,
        candidateIds: pool.candidateIds.filter((id) => !toRemove.has(id)),
        updatedAt: nowISO(),
      };
      return ok({ removed: action.candidateIds.length, pool: updated, _storeOp: "upsert_talent_pool", _entity: updated });
    }

    case "search": {
      const q = action.query.toLowerCase();
      const tagFilter = action.tags?.map((t) => t.toLowerCase()) ?? [];
      const results = Object.values(pools).filter((p) => {
        const textMatch =
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        const tagMatch = tagFilter.length === 0 ||
          tagFilter.some((t) => p.tags.some((pt) => pt.toLowerCase().includes(t)));
        return textMatch && tagMatch;
      });
      return ok({ results: results.map((p) => ({ ...p, candidateCount: p.candidateIds.length })), total: results.length });
    }

    case "analytics": {
      const targetPools = action.poolId
        ? [pools[action.poolId]].filter(Boolean)
        : Object.values(pools);
      if (targetPools.length === 0) return err("No pools found");

      const analytics = targetPools.map((pool) => {
        const poolCandidates = pool.candidateIds.map((id) => candidates[id]).filter(Boolean);
        const stageDist: Record<string, number> = {};
        const tagDist: Record<string, number> = {};
        for (const c of poolCandidates) {
          stageDist[c.currentStage] = (stageDist[c.currentStage] || 0) + 1;
          for (const t of c.tags) tagDist[t] = (tagDist[t] || 0) + 1;
        }
        return {
          poolId: pool.id,
          poolName: pool.name,
          totalCandidates: pool.candidateIds.length,
          activeCandidates: poolCandidates.length,
          stageDistribution: stageDist,
          topTags: Object.entries(tagDist).sort(([, a], [, b]) => b - a).slice(0, 10),
          source: pool.source ?? "unknown",
        };
      });
      return ok({ analytics, totalPools: targetPools.length });
    }

    default:
      return err(`Unknown action: ${(action as { type: string }).type}`);
  }
}

export const mcpAtsTalentPoolTool = {
  name: "ats_talent_pool",
  description:
    "Manage passive candidate talent pools (CRM). Create pools, add/remove candidates, " +
    "search across pools, get pool analytics. Actions: create, update, delete, list, get, " +
    "add_candidates, remove_candidates, search, analytics.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "object" as const,
        description:
          'Action to perform. Set "type" to one of: create, update, delete, list, get, ' +
          "add_candidates, remove_candidates, search, analytics.",
      },
      state: {
        type: "object" as const,
        description: "Current ATS state containing talentPools and candidates.",
      },
    },
    required: ["action", "state"],
  },
  handler: (args: { action: Action; state: StateSlice }) => handleAction(args),
};
