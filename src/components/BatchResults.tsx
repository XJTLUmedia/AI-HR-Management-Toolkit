"use client";

import { useState } from "react";
import type { BatchResult } from "./BatchUpload";

interface BatchResultsProps {
  results: BatchResult[];
  onSelectResume: (result: BatchResult) => void;
}

export function BatchResults({ results, onSelectResume }: BatchResultsProps) {
  const [sortField, setSortField] = useState<"name" | "skills" | "experience" | "status">("name");
  const [sortAsc, setSortAsc] = useState(true);

  const getContact = (r: BatchResult) =>
    (r.structured?.contact as Record<string, string> | undefined) ?? {};
  const getSkills = (r: BatchResult) =>
    (r.structured?.skills as Array<{ name: string }> | undefined) ?? [];
  const getExperience = (r: BatchResult) =>
    (r.structured?.experience as Array<Record<string, unknown>> | undefined) ?? [];

  const sorted = [...results].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortField === "name") return dir * (getContact(a).name ?? a.fileName).localeCompare(getContact(b).name ?? b.fileName);
    if (sortField === "skills") return dir * (getSkills(a).length - getSkills(b).length);
    if (sortField === "experience") return dir * (getExperience(a).length - getExperience(b).length);
    if (sortField === "status") return dir * (Number(a.success) - Number(b.success));
    return 0;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    <span className="ml-1 text-xs">{sortField === field ? (sortAsc ? "↑" : "↓") : "↕"}</span>
  );

  return (
    <div className="overflow-x-auto rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>#</th>
            <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }} onClick={() => handleSort("status")}>
              Status<SortIcon field="status" />
            </th>
            <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }} onClick={() => handleSort("name")}>
              Name / File<SortIcon field="name" />
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Email</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Phone</th>
            <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }} onClick={() => handleSort("skills")}>
              Skills<SortIcon field="skills" />
            </th>
            <th className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }} onClick={() => handleSort("experience")}>
              Exp.<SortIcon field="experience" />
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Top Skills</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const contact = getContact(r);
            const skills = getSkills(r);
            const exp = getExperience(r);

            return (
              <tr
                key={i}
                className="transition-colors"
                style={{ borderBottom: '1px solid var(--border-light)' }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-secondary)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                <td className="px-4 py-3">
                  {r.success ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                      OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }} title={r.error}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--danger)' }} />
                      Error
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: 'var(--foreground)' }}>
                    {contact.name || "—"}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{r.fileName}</div>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{contact.email || "—"}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{contact.phone || "—"}</td>
                <td className="px-4 py-3 text-center" style={{ color: 'var(--foreground)' }}>{skills.length}</td>
                <td className="px-4 py-3 text-center" style={{ color: 'var(--foreground)' }}>{exp.length}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                  {skills.slice(0, 5).map((s) => s.name).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  {r.success && (
                    <button
                      onClick={() => onSelectResume(r)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                      style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 18%, transparent)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 10%, transparent)'}
                    >
                      View
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {results.length === 0 && (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
          No results yet. Upload files above to start batch processing.
        </p>
      )}
    </div>
  );
}
