"use client";

import { useState } from "react";
import type { AssessmentCriteria } from "@/lib/schemas/criteria";

interface CriteriaEditorProps {
  onCriteriaChange: (criteria: AssessmentCriteria) => void;
  initialCriteria?: AssessmentCriteria;
}

const DEFAULT_CRITERIA: AssessmentCriteria = {
  name: "Default Assessment",
  description: "",
  education: {
    enabled: true,
    weight: 15,
    minimumDegreeLevel: "none",
    preferredFields: [],
    targetUniversities: [],
    acceptAnyAccredited: true,
  },
  experience: {
    enabled: true,
    weight: 25,
    minimumYears: 0,
    requiredIndustries: [],
    preferredCompanies: [],
    requiredJobTitles: [],
  },
  skills: {
    enabled: true,
    weight: 25,
    requiredSkills: [],
    niceToHaveSkills: [],
    minimumSkillMatchPercent: 60,
  },
  certifications: {
    enabled: true,
    weight: 10,
    requiredCertifications: [],
    preferredCertifications: [],
  },
  knowledgeStack: {
    enabled: true,
    weight: 10,
    requiredLanguages: [],
    requiredFrameworks: [],
    requiredTools: [],
    requiredDatabases: [],
    requiredPlatforms: [],
  },
  competitions: {
    enabled: true,
    weight: 5,
    valuedCompetitions: [],
    requirePublications: false,
    requirePatents: false,
    requireOpenSource: false,
  },
  thresholds: {
    autoPassPercent: 80,
    reviewRangePercent: { min: 50, max: 79 },
    autoRejectBelowPercent: 50,
  },
  jobQualification: {
    enabled: true,
    weight: 10,
    jobDescription: "",
    companyCultureKeywords: [],
    softSkillsRequired: [],
    leadershipRequired: false,
  },
};

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)' }}
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="input-field flex-1 !py-1 !text-xs"
        />
        <button
          onClick={addTag}
          className="btn-primary !rounded-lg !px-3 !py-1 !text-xs"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function SectionToggle({
  label,
  enabled,
  weight,
  onToggle,
  onWeightChange,
  children,
}: {
  label: string;
  enabled: boolean;
  weight: number;
  onToggle: (v: boolean) => void;
  onWeightChange: (v: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-2.5">
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="peer sr-only"
            />
            <div
              className="h-5 w-9 rounded-full after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"
              style={{ background: enabled ? 'var(--primary)' : 'var(--border)' }}
            />
          </label>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          <span>Weight:</span>
          <input
            type="number"
            min={0}
            max={100}
            value={weight}
            onChange={(e) => onWeightChange(Number(e.target.value))}
            disabled={!enabled}
            className="input-field !w-14 !px-1.5 !py-0.5 !text-center !text-xs"
          />
          <span>%</span>
        </div>
      </div>
      {enabled && <div className="space-y-3 px-4 py-3">{children}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>
      {children}
    </label>
  );
}

export function CriteriaEditor({ onCriteriaChange, initialCriteria }: CriteriaEditorProps) {
  const [criteria, setCriteria] = useState<AssessmentCriteria>(
    initialCriteria ?? DEFAULT_CRITERIA
  );

  const update = (patch: Partial<AssessmentCriteria>) => {
    const next = { ...criteria, ...patch };
    setCriteria(next);
    onCriteriaChange(next);
  };

  const updateEd = (patch: Partial<AssessmentCriteria["education"]>) =>
    update({ education: { ...criteria.education, ...patch } });
  const updateExp = (patch: Partial<AssessmentCriteria["experience"]>) =>
    update({ experience: { ...criteria.experience, ...patch } });
  const updateSk = (patch: Partial<AssessmentCriteria["skills"]>) =>
    update({ skills: { ...criteria.skills, ...patch } });
  const updateCert = (patch: Partial<AssessmentCriteria["certifications"]>) =>
    update({ certifications: { ...criteria.certifications, ...patch } });
  const updateKs = (patch: Partial<AssessmentCriteria["knowledgeStack"]>) =>
    update({ knowledgeStack: { ...criteria.knowledgeStack, ...patch } });
  const updateComp = (patch: Partial<AssessmentCriteria["competitions"]>) =>
    update({ competitions: { ...criteria.competitions, ...patch } });
  const updateTh = (patch: Partial<AssessmentCriteria["thresholds"]>) =>
    update({ thresholds: { ...criteria.thresholds, ...patch } });
  const updateJq = (patch: Partial<AssessmentCriteria["jobQualification"]>) =>
    update({ jobQualification: { ...criteria.jobQualification, ...patch } });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <input
          type="text"
          value={criteria.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Assessment name"
          className="input-field w-full !text-sm !font-medium"
        />
        <input
          type="text"
          value={criteria.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Description (optional)"
          className="input-field w-full !text-xs"
        />
      </div>

      {/* Education */}
      <SectionToggle
        label="Education"
        enabled={criteria.education.enabled}
        weight={criteria.education.weight}
        onToggle={(v) => updateEd({ enabled: v })}
        onWeightChange={(v) => updateEd({ weight: v })}
      >
        <div>
          <FieldLabel>Minimum Degree Level</FieldLabel>
          <select
            value={criteria.education.minimumDegreeLevel}
            onChange={(e) =>
              updateEd({ minimumDegreeLevel: e.target.value as AssessmentCriteria["education"]["minimumDegreeLevel"] })
            }
            className="input-field w-full !text-xs"
          >
            <option value="none">No requirement</option>
            <option value="associate">Associate</option>
            <option value="bachelor">Bachelor&apos;s</option>
            <option value="master">Master&apos;s</option>
            <option value="phd">PhD / Doctorate</option>
          </select>
        </div>
        <div>
          <FieldLabel>Preferred Fields of Study</FieldLabel>
          <TagInput
            tags={criteria.education.preferredFields}
            onChange={(v) => updateEd({ preferredFields: v })}
            placeholder="e.g. Computer Science, Engineering"
          />
        </div>
        <div>
          <FieldLabel>Target Universities</FieldLabel>
          <TagInput
            tags={criteria.education.targetUniversities}
            onChange={(v) => updateEd({ targetUniversities: v })}
            placeholder="e.g. MIT, Stanford, Tsinghua"
          />
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
          <input
            type="checkbox"
            checked={criteria.education.acceptAnyAccredited}
            onChange={(e) => updateEd({ acceptAnyAccredited: e.target.checked })}
            style={{ accentColor: 'var(--primary)' }}
          />
          Accept any accredited institution (if no targets specified)
        </label>
      </SectionToggle>

      {/* Experience */}
      <SectionToggle
        label="Experience"
        enabled={criteria.experience.enabled}
        weight={criteria.experience.weight}
        onToggle={(v) => updateExp({ enabled: v })}
        onWeightChange={(v) => updateExp({ weight: v })}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Minimum Years</FieldLabel>
            <input
              type="number"
              min={0}
              value={criteria.experience.minimumYears}
              onChange={(e) => updateExp({ minimumYears: Number(e.target.value) })}
              className="input-field w-full !text-xs"
            />
          </div>
          <div>
            <FieldLabel>Preferred Range (min-max years)</FieldLabel>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                min={0}
                placeholder="Min"
                value={criteria.experience.preferredYearsRange?.min ?? ""}
                onChange={(e) => {
                  const min = Number(e.target.value);
                  updateExp({
                    preferredYearsRange: {
                      min,
                      max: criteria.experience.preferredYearsRange?.max ?? min + 5,
                    },
                  });
                }}
                className="input-field w-full !text-xs"
              />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>–</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                value={criteria.experience.preferredYearsRange?.max ?? ""}
                onChange={(e) => {
                  const max = Number(e.target.value);
                  updateExp({
                    preferredYearsRange: {
                      min: criteria.experience.preferredYearsRange?.min ?? 0,
                      max,
                    },
                  });
                }}
                className="input-field w-full !text-xs"
              />
            </div>
          </div>
        </div>
        <div>
          <FieldLabel>Required Industries</FieldLabel>
          <TagInput
            tags={criteria.experience.requiredIndustries}
            onChange={(v) => updateExp({ requiredIndustries: v })}
            placeholder="e.g. Fintech, Healthcare, E-commerce"
          />
        </div>
        <div>
          <FieldLabel>Preferred Companies</FieldLabel>
          <TagInput
            tags={criteria.experience.preferredCompanies}
            onChange={(v) => updateExp({ preferredCompanies: v })}
            placeholder="e.g. Google, Meta, Amazon"
          />
        </div>
        <div>
          <FieldLabel>Required Job Titles</FieldLabel>
          <TagInput
            tags={criteria.experience.requiredJobTitles}
            onChange={(v) => updateExp({ requiredJobTitles: v })}
            placeholder="e.g. Senior Engineer, Tech Lead"
          />
        </div>
      </SectionToggle>

      {/* Skills */}
      <SectionToggle
        label="Skills"
        enabled={criteria.skills.enabled}
        weight={criteria.skills.weight}
        onToggle={(v) => updateSk({ enabled: v })}
        onWeightChange={(v) => updateSk({ weight: v })}
      >
        <div>
          <FieldLabel>Required Skills</FieldLabel>
          <TagInput
            tags={criteria.skills.requiredSkills.map((s) => s.name)}
            onChange={(names) =>
              updateSk({
                requiredSkills: names.map((name) => ({
                  name,
                  required: true,
                  minimumProficiency: "intermediate" as const,
                })),
              })
            }
            placeholder="e.g. React, TypeScript, Python"
          />
        </div>
        <div>
          <FieldLabel>Nice-to-Have Skills</FieldLabel>
          <TagInput
            tags={criteria.skills.niceToHaveSkills}
            onChange={(v) => updateSk({ niceToHaveSkills: v })}
            placeholder="e.g. GraphQL, Redis, Docker"
          />
        </div>
        <div>
          <FieldLabel>Minimum Skill Match %</FieldLabel>
          <input
            type="number"
            min={0}
            max={100}
            value={criteria.skills.minimumSkillMatchPercent}
            onChange={(e) => updateSk({ minimumSkillMatchPercent: Number(e.target.value) })}
            className="input-field !w-20 !text-xs"
          />
        </div>
      </SectionToggle>

      {/* Certifications */}
      <SectionToggle
        label="Certifications"
        enabled={criteria.certifications.enabled}
        weight={criteria.certifications.weight}
        onToggle={(v) => updateCert({ enabled: v })}
        onWeightChange={(v) => updateCert({ weight: v })}
      >
        <div>
          <FieldLabel>Required Certifications</FieldLabel>
          <TagInput
            tags={criteria.certifications.requiredCertifications}
            onChange={(v) => updateCert({ requiredCertifications: v })}
            placeholder="e.g. AWS Solutions Architect, PMP, CPA"
          />
        </div>
        <div>
          <FieldLabel>Preferred Certifications</FieldLabel>
          <TagInput
            tags={criteria.certifications.preferredCertifications}
            onChange={(v) => updateCert({ preferredCertifications: v })}
            placeholder="e.g. Google Cloud Professional, Kubernetes CKA"
          />
        </div>
      </SectionToggle>

      {/* Knowledge Stack */}
      <SectionToggle
        label="Knowledge Stack"
        enabled={criteria.knowledgeStack.enabled}
        weight={criteria.knowledgeStack.weight}
        onToggle={(v) => updateKs({ enabled: v })}
        onWeightChange={(v) => updateKs({ weight: v })}
      >
        <div>
          <FieldLabel>Required Languages</FieldLabel>
          <TagInput
            tags={criteria.knowledgeStack.requiredLanguages}
            onChange={(v) => updateKs({ requiredLanguages: v })}
            placeholder="e.g. TypeScript, Python, Go"
          />
        </div>
        <div>
          <FieldLabel>Required Frameworks</FieldLabel>
          <TagInput
            tags={criteria.knowledgeStack.requiredFrameworks}
            onChange={(v) => updateKs({ requiredFrameworks: v })}
            placeholder="e.g. React, Next.js, Django"
          />
        </div>
        <div>
          <FieldLabel>Required Tools</FieldLabel>
          <TagInput
            tags={criteria.knowledgeStack.requiredTools}
            onChange={(v) => updateKs({ requiredTools: v })}
            placeholder="e.g. Docker, Kubernetes, Git"
          />
        </div>
        <div>
          <FieldLabel>Required Databases</FieldLabel>
          <TagInput
            tags={criteria.knowledgeStack.requiredDatabases}
            onChange={(v) => updateKs({ requiredDatabases: v })}
            placeholder="e.g. PostgreSQL, MongoDB, Redis"
          />
        </div>
        <div>
          <FieldLabel>Required Platforms</FieldLabel>
          <TagInput
            tags={criteria.knowledgeStack.requiredPlatforms}
            onChange={(v) => updateKs({ requiredPlatforms: v })}
            placeholder="e.g. AWS, GCP, Azure"
          />
        </div>
      </SectionToggle>

      {/* Competitions / Achievements */}
      <SectionToggle
        label="Competitions & Achievements"
        enabled={criteria.competitions.enabled}
        weight={criteria.competitions.weight}
        onToggle={(v) => updateComp({ enabled: v })}
        onWeightChange={(v) => updateComp({ weight: v })}
      >
        <div>
          <FieldLabel>Valued Competitions / Awards</FieldLabel>
          <TagInput
            tags={criteria.competitions.valuedCompetitions}
            onChange={(v) => updateComp({ valuedCompetitions: v })}
            placeholder="e.g. ICPC, Kaggle, Hackathon"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={criteria.competitions.requirePublications}
              onChange={(e) => updateComp({ requirePublications: e.target.checked })}
              style={{ accentColor: 'var(--primary)' }}
            />
            Require publications
          </label>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={criteria.competitions.requirePatents}
              onChange={(e) => updateComp({ requirePatents: e.target.checked })}
              style={{ accentColor: 'var(--primary)' }}
            />
            Require patents
          </label>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={criteria.competitions.requireOpenSource}
              onChange={(e) => updateComp({ requireOpenSource: e.target.checked })}
              style={{ accentColor: 'var(--primary)' }}
            />
            Require open source contributions
          </label>
        </div>
      </SectionToggle>

      {/* Pass Thresholds */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Pass / Reject Thresholds
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 px-4 py-3">
          <div>
            <FieldLabel>Auto-Pass ≥ (%)</FieldLabel>
            <input
              type="number"
              min={0}
              max={100}
              value={criteria.thresholds.autoPassPercent}
              onChange={(e) => updateTh({ autoPassPercent: Number(e.target.value) })}
              className="input-field w-full !text-xs"
            />
          </div>
          <div>
            <FieldLabel>Review Range (%)</FieldLabel>
            <div className="flex gap-1 items-center">
              <input
                type="number"
                min={0}
                max={100}
                value={criteria.thresholds.reviewRangePercent.min}
                onChange={(e) =>
                  updateTh({
                    reviewRangePercent: {
                      ...criteria.thresholds.reviewRangePercent,
                      min: Number(e.target.value),
                    },
                  })
                }
                className="input-field w-full !text-xs"
              />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>–</span>
              <input
                type="number"
                min={0}
                max={100}
                value={criteria.thresholds.reviewRangePercent.max}
                onChange={(e) =>
                  updateTh({
                    reviewRangePercent: {
                      ...criteria.thresholds.reviewRangePercent,
                      max: Number(e.target.value),
                    },
                  })
                }
                className="input-field w-full !text-xs"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Auto-Reject &lt; (%)</FieldLabel>
            <input
              type="number"
              min={0}
              max={100}
              value={criteria.thresholds.autoRejectBelowPercent}
              onChange={(e) => updateTh({ autoRejectBelowPercent: Number(e.target.value) })}
              className="input-field w-full !text-xs"
            />
          </div>
        </div>
      </div>

      {/* Job Qualification / Company Fit */}
      <SectionToggle
        label="Job Qualification & Company Fit"
        enabled={criteria.jobQualification.enabled}
        weight={criteria.jobQualification.weight}
        onToggle={(v) => updateJq({ enabled: v })}
        onWeightChange={(v) => updateJq({ weight: v })}
      >
        <div>
          <FieldLabel>Job Description (for text matching)</FieldLabel>
          <textarea
            rows={4}
            value={criteria.jobQualification.jobDescription}
            onChange={(e) => updateJq({ jobDescription: e.target.value })}
            placeholder="Paste the job description here to match against resumes..."
            className="input-field w-full !text-xs"
          />
        </div>
        <div>
          <FieldLabel>Required Soft Skills</FieldLabel>
          <TagInput
            tags={criteria.jobQualification.softSkillsRequired}
            onChange={(v) => updateJq({ softSkillsRequired: v })}
            placeholder="e.g. Communication, Leadership, Teamwork"
          />
        </div>
        <div>
          <FieldLabel>Company Culture Keywords</FieldLabel>
          <TagInput
            tags={criteria.jobQualification.companyCultureKeywords}
            onChange={(v) => updateJq({ companyCultureKeywords: v })}
            placeholder="e.g. Innovation, Collaboration, Fast-paced"
          />
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
          <input
            type="checkbox"
            checked={criteria.jobQualification.leadershipRequired}
            onChange={(e) => updateJq({ leadershipRequired: e.target.checked })}
            style={{ accentColor: 'var(--primary)' }}
          />
          Leadership experience required
        </label>
      </SectionToggle>

      {/* Import/Export criteria */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => {
            const json = JSON.stringify(criteria, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${criteria.name.replace(/\s+/g, "-").toLowerCase()}-criteria.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="btn-secondary !text-xs"
        >
          Export Criteria
        </button>
        <label className="btn-secondary !text-xs cursor-pointer">
          Import Criteria
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const parsed = JSON.parse(reader.result as string);
                  const validated = { ...DEFAULT_CRITERIA, ...parsed };
                  setCriteria(validated);
                  onCriteriaChange(validated);
                } catch {
                  alert("Invalid criteria file");
                }
              };
              reader.readAsText(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}

export { DEFAULT_CRITERIA };
