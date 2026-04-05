"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useATS } from "@/lib/ats/context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function TalentPoolManager() {
  const { state, dispatch } = useATS();
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolDesc, setNewPoolDesc] = useState("");
  const [newPoolTags, setNewPoolTags] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Edit pool state
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editPoolName, setEditPoolName] = useState("");
  const [editPoolDesc, setEditPoolDesc] = useState("");
  const [editPoolTags, setEditPoolTags] = useState("");

  const pools = useMemo(() => Object.values(state.talentPools ?? {}), [state.talentPools]);
  const candidates = useMemo(() => Object.values(state.candidates ?? {}), [state.candidates]);

  const filteredPools = useMemo(() => {
    if (!searchQuery) return pools;
    const q = searchQuery.toLowerCase();
    return pools.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [pools, searchQuery]);

  const selectedPool = useMemo(
    () => (selectedPoolId ? (state.talentPools ?? {})[selectedPoolId] : null),
    [selectedPoolId, state.talentPools]
  );

  const poolCandidates = useMemo(() => {
    if (!selectedPool) return [];
    return selectedPool.candidateIds
      .map((id) => (state.candidates ?? {})[id])
      .filter(Boolean);
  }, [selectedPool, state.candidates]);

  const availableCandidates = useMemo(() => {
    if (!selectedPool) return [];
    const inPool = new Set(selectedPool.candidateIds);
    return candidates.filter((c) => !inPool.has(c.id));
  }, [selectedPool, candidates]);

  function handleCreate() {
    if (!newPoolName.trim()) return;
    const id = `pool_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    dispatch({
      type: "ADD_TALENT_POOL",
      pool: {
        id,
        name: newPoolName.trim(),
        description: newPoolDesc.trim(),
        tags: newPoolTags.split(",").map((t) => t.trim()).filter(Boolean),
        candidateIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    setNewPoolName("");
    setNewPoolDesc("");
    setNewPoolTags("");
    setShowCreate(false);
  }

  function handleAddCandidate(candidateId: string) {
    if (!selectedPool) return;
    dispatch({
      type: "UPDATE_TALENT_POOL",
      pool: {
        ...selectedPool,
        candidateIds: [...selectedPool.candidateIds, candidateId],
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function handleRemoveCandidate(candidateId: string) {
    if (!selectedPool) return;
    dispatch({
      type: "UPDATE_TALENT_POOL",
      pool: {
        ...selectedPool,
        candidateIds: selectedPool.candidateIds.filter((id) => id !== candidateId),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function handleDeletePool(poolId: string) {
    dispatch({ type: "DELETE_TALENT_POOL", id: poolId });
    if (selectedPoolId === poolId) setSelectedPoolId(null);
    if (editingPoolId === poolId) setEditingPoolId(null);
  }

  function startEditPool(pool: (typeof pools)[0]) {
    setEditingPoolId(pool.id);
    setEditPoolName(pool.name);
    setEditPoolDesc(pool.description);
    setEditPoolTags(pool.tags.join(", "));
  }

  function handleSavePool() {
    if (!editingPoolId || !editPoolName.trim()) return;
    const existing = (state.talentPools ?? {})[editingPoolId];
    if (!existing) return;
    dispatch({
      type: "UPDATE_TALENT_POOL",
      pool: {
        ...existing,
        name: editPoolName.trim(),
        description: editPoolDesc.trim(),
        tags: editPoolTags.split(",").map((t) => t.trim()).filter(Boolean),
        updatedAt: new Date().toISOString(),
      },
    });
    setEditingPoolId(null);
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400"><UsersIcon /></div>
          <div>
            <h2 className="text-xl font-semibold text-white">Talent Pool CRM</h2>
            <p className="text-sm text-zinc-400">{pools.length} pools · {pools.reduce((s, p) => s + p.candidateIds.length, 0)} candidates</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
        >
          + New Pool
        </button>
      </motion.div>

      {showCreate && (
        <motion.div variants={itemVariants} className="bg-zinc-900 rounded-lg p-5 border border-zinc-800 space-y-3">
          <input
            placeholder="Pool name"
            value={newPoolName}
            onChange={(e) => setNewPoolName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            placeholder="Description"
            value={newPoolDesc}
            onChange={(e) => setNewPoolDesc(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            placeholder="Tags (comma-separated)"
            value={newPoolTags}
            onChange={(e) => setNewPoolTags(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <input
          placeholder="Search pools by name, description, or tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">All Pools</h3>
          {filteredPools.length === 0 && (
            <p className="text-sm text-zinc-500 py-4 text-center">No pools yet. Create one to start managing passive candidates.</p>
          )}
          {filteredPools.map((pool) => (
            <div
              key={pool.id}
              onClick={() => setSelectedPoolId(pool.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedPoolId === pool.id
                  ? "bg-violet-500/10 border-violet-500/50 ring-1 ring-violet-500/30"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{pool.name}</span>
                <span className="text-xs text-zinc-400">{pool.candidateIds.length} candidates</span>
              </div>
              {pool.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{pool.description}</p>}
              {pool.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {pool.tags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded">{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); startEditPool(pool); }}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePool(pool.id); }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          {selectedPool ? (
            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-lg p-5 border border-zinc-800">
                {editingPoolId === selectedPool.id ? (
                  <div className="space-y-3">
                    <input value={editPoolName} onChange={(e) => setEditPoolName(e.target.value)} placeholder="Pool name" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
                    <input value={editPoolDesc} onChange={(e) => setEditPoolDesc(e.target.value)} placeholder="Description" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none" />
                    <input value={editPoolTags} onChange={(e) => setEditPoolTags(e.target.value)} placeholder="Tags (comma-separated)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none" />
                    <div className="flex gap-2">
                      <button onClick={handleSavePool} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500">Save</button>
                      <button onClick={() => setEditingPoolId(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-white">{selectedPool.name}</h3>
                      <button onClick={() => startEditPool(selectedPool)} className="text-xs text-violet-400 hover:text-violet-300">Edit</button>
                    </div>
                    {selectedPool.description && <p className="text-sm text-zinc-400 mt-1">{selectedPool.description}</p>}
                    <p className="text-xs text-zinc-500 mt-2">
                      Created {new Date(selectedPool.createdAt).toLocaleDateString()} · Source: {selectedPool.source ?? "manual"}
                    </p>
                  </>
                )}
              </div>

              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-zinc-300">Pool Candidates ({poolCandidates.length})</h4>
                </div>
                {poolCandidates.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-3">No candidates in this pool.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {poolCandidates.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                        <div>
                          <span className="text-sm text-white">{c.firstName} {c.lastName}</span>
                          <span className="text-xs text-zinc-500 ml-2">{c.email}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveCandidate(c.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {availableCandidates.length > 0 && (
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Add Candidates</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableCandidates.slice(0, 20).map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                        <span className="text-sm text-zinc-300">{c.firstName} {c.lastName}</span>
                        <button
                          onClick={() => handleAddCandidate(c.id)}
                          className="text-xs text-violet-400 hover:text-violet-300"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                    {availableCandidates.length > 20 && (
                      <p className="text-xs text-zinc-500 text-center">and {availableCandidates.length - 20} more...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-zinc-900 rounded-lg border border-zinc-800">
              <p className="text-sm text-zinc-500">Select a pool to view details</p>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
