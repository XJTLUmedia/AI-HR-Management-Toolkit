"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import type { Offer, OfferStatus, OfferApproval } from "@/lib/ats/types";
import { generateId, nowISO } from "@/lib/ats/types";

/* ────────── helpers ────────── */

const STATUS_COLORS: Record<OfferStatus, string> = {
  draft: "var(--muted)",
  "pending-approval": "var(--warning)",
  approved: "var(--primary)",
  sent: "var(--primary)",
  accepted: "var(--success)",
  declined: "var(--danger)",
  expired: "var(--muted)",
  withdrawn: "var(--muted)",
};

function fmtCurrency(n: number, cur = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
}

/* ────────── component ────────── */

export function OfferManager() {
  const { state, dispatch, setCurrentView } = useATS();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OfferStatus | "all">("all");

  /* form state */
  const empty = {
    candidateId: "",
    jobId: "",
    salary: 80000,
    currency: "USD",
    period: "annual" as "annual" | "monthly",
    bonus: "",
    equity: "",
    benefits: "",
    startDate: "",
    expiresAt: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  /* approval form */
  const [approvalForm, setApprovalForm] = useState({ approver: "", approved: true, comment: "" });

  const offers = useMemo(() => {
    let list = Object.values(state.offers).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    return list;
  }, [state.offers, statusFilter]);

  const candidates = useMemo(() => Object.values(state.candidates), [state.candidates]);
  const jobs = useMemo(
    () => Object.values(state.jobs).filter((j) => j.status === "open"),
    [state.jobs]
  );

  /* handlers */

  function openEdit(offer: Offer) {
    setForm({
      candidateId: offer.candidateId,
      jobId: offer.jobId,
      salary: offer.salary.base,
      currency: offer.salary.currency,
      period: offer.salary.period as "annual" | "monthly",
      bonus: offer.bonus?.toString() ?? "",
      equity: offer.equity ?? "",
      benefits: offer.benefits.join(", "),
      startDate: offer.startDate.slice(0, 10),
      expiresAt: offer.expiresAt.slice(0, 10),
      notes: offer.notes ?? "",
    });
    setSelectedId(offer.id);
    setCreating(false);
  }

  function handleSave() {
    if (!form.candidateId || !form.jobId) return;
    const base: Omit<Offer, "id" | "createdAt" | "updatedAt" | "status" | "approvals"> = {
      candidateId: form.candidateId,
      jobId: form.jobId,
      salary: { base: form.salary, currency: form.currency, period: form.period },
      bonus: form.bonus ? Number(form.bonus) : undefined,
      equity: form.equity || undefined,
      benefits: form.benefits
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      startDate: form.startDate ? new Date(form.startDate).toISOString() : nowISO(),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : nowISO(),
      notes: form.notes || undefined,
    };

    if (creating) {
      const offer: Offer = {
        ...base,
        id: generateId(),
        status: "draft",
        approvals: [],
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      dispatch({ type: "ADD_OFFER", offer });
      dispatch({
        type: "ADD_ACTIVITY",
        candidateId: form.candidateId,
        activity: {
          id: generateId(),
          type: "offer-created",
          description: `Offer created — ${fmtCurrency(form.salary)}`,
          timestamp: nowISO(),
        },
      });
    } else if (selectedId) {
      const prev = state.offers[selectedId];
      if (!prev) return;
      dispatch({
        type: "UPDATE_OFFER",
        offer: { ...prev, ...base, updatedAt: nowISO() },
      });
    }
    setSelectedId(null);
    setCreating(false);
    setForm(empty);
  }

  function changeStatus(id: string, newStatus: OfferStatus) {
    const offer = state.offers[id];
    if (!offer) return;
    dispatch({
      type: "UPDATE_OFFER",
      offer: { ...offer, status: newStatus, updatedAt: nowISO() },
    });
    dispatch({
      type: "ADD_ACTIVITY",
      candidateId: offer.candidateId,
      activity: {
        id: generateId(),
        type: "offer-updated",
        description: `Offer status → ${newStatus}`,
        timestamp: nowISO(),
      },
    });
  }

  function addApproval(offerId: string) {
    const offer = state.offers[offerId];
    if (!offer || !approvalForm.approver) return;
    const approval: OfferApproval = {
      approver: approvalForm.approver,
      status: approvalForm.approved ? "approved" : "rejected",
      comment: approvalForm.comment || undefined,
      respondedAt: nowISO(),
    };
    const updatedApprovals = [...offer.approvals, approval];
    const allApproved = updatedApprovals.every((a) => a.status === "approved");
    const anyRejected = updatedApprovals.some((a) => a.status === "rejected");
    let newStatus: OfferStatus = offer.status;
    if (anyRejected) newStatus = "withdrawn";
    else if (allApproved && updatedApprovals.length > 0) newStatus = "approved";

    dispatch({
      type: "UPDATE_OFFER",
      offer: { ...offer, approvals: updatedApprovals, status: newStatus, updatedAt: nowISO() },
    });
    setApprovalForm({ approver: "", approved: true, comment: "" });
  }

  function deleteOffer(id: string) {
    if (!confirm("Delete this offer?")) return;
    dispatch({ type: "DELETE_OFFER", id });
  }

  /* ── styles ── */
  const cardStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  };
  const input: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    padding: 8,
    borderRadius: 8,
    width: "100%",
    fontSize: 14,
  };
  const badgeStyle = (color: string): React.CSSProperties => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 99,
    background: color,
    color: "#fff",
  });
  const btnPrimary: React.CSSProperties = {
    background: "var(--primary)",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  };
  const btnSecondary: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  };
  const btnSmall: React.CSSProperties = {
    ...btnSecondary,
    fontSize: 12,
    padding: "4px 10px",
  };

  /* ── form view ── */
  if (creating || selectedId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 600, margin: "0 auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            style={btnSecondary}
            onClick={() => {
              setSelectedId(null);
              setCreating(false);
              setForm(empty);
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {creating ? "Create Offer" : "Edit Offer"}
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Candidate *
            </span>
            <select
              style={input}
              value={form.candidateId}
              onChange={(e) => setForm({ ...form, candidateId: e.target.value })}
            >
              <option value="">Select candidate...</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Job *
            </span>
            <select
              style={input}
              value={form.jobId}
              onChange={(e) => setForm({ ...form, jobId: e.target.value })}
            >
              <option value="">Select job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Base Salary
              </span>
              <input
                type="number"
                style={input}
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
              />
            </label>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Currency
              </span>
              <select
                style={input}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
                <option>CNY</option>
              </select>
            </label>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Period
              </span>
              <select
                style={input}
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value as "annual" | "monthly" })}
              >
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Signing Bonus
              </span>
              <input
                type="number"
                style={input}
                value={form.bonus}
                placeholder="0"
                onChange={(e) => setForm({ ...form, bonus: e.target.value })}
              />
            </label>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Equity
              </span>
              <input
                style={input}
                value={form.equity}
                placeholder="0.1%"
                onChange={(e) => setForm({ ...form, equity: e.target.value })}
              />
            </label>
          </div>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Benefits (comma-separated)
            </span>
            <input
              style={input}
              value={form.benefits}
              placeholder="Health, Dental, 401k, PTO"
              onChange={(e) => setForm({ ...form, benefits: e.target.value })}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Start Date
              </span>
              <input
                type="date"
                style={input}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </label>
            <label>
              <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                Expiration Date
              </span>
              <input
                type="date"
                style={input}
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </label>
          </div>

          <label>
            <span style={{ fontSize: 13, color: "var(--muted)", display: "block", marginBottom: 4 }}>
              Notes
            </span>
            <textarea
              style={{ ...input, minHeight: 60, resize: "vertical" }}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button style={btnPrimary} onClick={handleSave}>
              {creating ? "Create Offer" : "Save Changes"}
            </button>
            <button
              style={btnSecondary}
              onClick={() => {
                setSelectedId(null);
                setCreating(false);
                setForm(empty);
              }}
            >
              Cancel
            </button>
            {selectedId && (
              <button
                style={{ ...btnSecondary, color: "var(--danger)", marginLeft: "auto" }}
                onClick={() => {
                  deleteOffer(selectedId);
                  setSelectedId(null);
                  setForm(empty);
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── list view ── */
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Offers</h2>
        <button
          style={btnPrimary}
          onClick={() => {
            setCreating(true);
            setForm(empty);
          }}
        >
          + Create Offer
        </button>
      </div>

      {/* filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {(
          ["all", "draft", "pending-approval", "approved", "sent", "accepted", "declined", "withdrawn"] as const
        ).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              ...btnSecondary,
              background: statusFilter === s ? "var(--primary)" : "var(--surface)",
              color: statusFilter === s ? "#fff" : "var(--foreground)",
              fontSize: 12,
              padding: "5px 10px",
            }}
          >
            {s === "all" ? "All" : s.replace("-", " ")}
          </button>
        ))}
      </div>

      <AnimatePresence mode="popLayout">
        {offers.length === 0 && (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📄</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>No Offers Yet</p>
            <p style={{ fontSize: 13, maxWidth: 360, margin: "4px auto 16px" }}>
              Create offers for candidates who pass the interview stage, or load demo data from Settings to explore.
            </p>
            <button
              onClick={() => setCurrentView("settings")}
              style={{ background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)", padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
            >
              Load Demo Data
            </button>
          </div>
        )}
        {offers.map((offer) => {
          const cand = state.candidates[offer.candidateId];
          const job = state.jobs[offer.jobId];
          return (
            <motion.div
              key={offer.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={cardStyle}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {cand ? `${cand.firstName} ${cand.lastName}` : "Unknown"} —{" "}
                    {job ? job.title : "Unknown Job"}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "var(--foreground)" }}>
                    {fmtCurrency(offer.salary.base, offer.salary.currency)}
                    <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>
                      {" "}
                      / {offer.salary.period}
                    </span>
                  </div>
                </div>
                <span style={badgeStyle(STATUS_COLORS[offer.status])}>
                  {offer.status.replace("-", " ")}
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--muted)", marginTop: 8, flexWrap: "wrap" }}>
                {offer.bonus && <span>Bonus: {fmtCurrency(offer.bonus, offer.salary.currency)}</span>}
                {offer.equity && <span>Equity: {offer.equity}</span>}
                <span>Start: {new Date(offer.startDate).toLocaleDateString()}</span>
                <span>Expires: {new Date(offer.expiresAt).toLocaleDateString()}</span>
              </div>

              {offer.benefits.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                  {offer.benefits.map((b, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: "var(--border)",
                        color: "var(--foreground)",
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}

              {/* approval section */}
              {offer.status === "pending-approval" && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "rgba(234,179,8,0.06)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Approvals</div>
                  {offer.approvals.map((a, i) => (
                    <div key={i} style={{ fontSize: 13, marginBottom: 4, display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          ...badgeStyle(a.status === "approved" ? "var(--success)" : a.status === "rejected" ? "var(--danger)" : "var(--warning)"),
                          fontSize: 10,
                        }}
                      >
                        {a.status}
                      </span>
                      <strong>{a.approver}</strong>
                      {a.comment && <span style={{ color: "var(--muted)" }}>— {a.comment}</span>}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      style={{ ...input, maxWidth: 140 }}
                      placeholder="Approver name"
                      value={approvalForm.approver}
                      onChange={(e) => setApprovalForm({ ...approvalForm, approver: e.target.value })}
                    />
                    <select
                      style={{ ...input, maxWidth: 100 }}
                      value={approvalForm.approved ? "yes" : "no"}
                      onChange={(e) =>
                        setApprovalForm({ ...approvalForm, approved: e.target.value === "yes" })
                      }
                    >
                      <option value="yes">Approve</option>
                      <option value="no">Reject</option>
                    </select>
                    <input
                      style={{ ...input, maxWidth: 160 }}
                      placeholder="Comment"
                      value={approvalForm.comment}
                      onChange={(e) => setApprovalForm({ ...approvalForm, comment: e.target.value })}
                    />
                    <button style={btnSmall} onClick={() => addApproval(offer.id)}>
                      Submit
                    </button>
                  </div>
                </div>
              )}

              {/* actions */}
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button style={btnSmall} onClick={() => openEdit(offer)}>
                  Edit
                </button>
                {offer.status === "draft" && (
                  <button style={btnSmall} onClick={() => changeStatus(offer.id, "pending-approval")}>
                    Submit for Approval
                  </button>
                )}
                {offer.status === "approved" && (
                  <button style={{ ...btnSmall, background: "var(--primary)", color: "#fff" }} onClick={() => changeStatus(offer.id, "sent")}>
                    Send to Candidate
                  </button>
                )}
                {offer.status === "sent" && (
                  <>
                    <button style={{ ...btnSmall, background: "var(--success)", color: "#fff" }} onClick={() => changeStatus(offer.id, "accepted")}>
                      Mark Accepted
                    </button>
                    <button style={{ ...btnSmall, color: "var(--danger)" }} onClick={() => changeStatus(offer.id, "declined")}>
                      Mark Declined
                    </button>
                    <button style={btnSmall} onClick={() => changeStatus(offer.id, "negotiating" as OfferStatus)}>
                      Negotiating
                    </button>
                  </>
                )}
                {(offer.status === "draft" || offer.status === "pending-approval" || offer.status === "sent") && (
                  <button style={{ ...btnSmall, color: "var(--danger)" }} onClick={() => changeStatus(offer.id, "withdrawn")}>
                    Withdraw
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
