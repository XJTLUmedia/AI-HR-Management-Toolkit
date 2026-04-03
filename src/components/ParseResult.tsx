"use client";

interface ParseResultProps {
  data: {
    rawText: string;
    structured: {
      contact?: {
        name?: string;
        email?: string;
        phone?: string;
        location?: string;
        linkedin?: string;
        github?: string;
        website?: string;
        portfolio?: string;
      };
      summary?: string;
      skills?: Array<{
        name: string;
        category?: string;
        proficiency?: string;
        context?: string;
      }>;
      experience?: Array<{
        company: string;
        title: string;
        location?: string;
        startDate?: string;
        endDate?: string;
        current?: boolean;
        description?: string;
        highlights?: string[];
        achievements?: Array<{
          description: string;
          metric?: string;
          impact?: string;
        }>;
        technologies?: string[];
      }>;
      education?: Array<{
        institution: string;
        degree?: string;
        field?: string;
        startDate?: string;
        endDate?: string;
        gpa?: string;
      }>;
      certifications?: Array<{
        name: string;
        issuer?: string;
        date?: string;
        credentialUrl?: string;
      }>;
      projects?: Array<{
        name: string;
        description?: string;
        url?: string;
        technologies?: string[];
        highlights?: string[];
      }>;
      languages?: string[];
    };
    pageCount: number | null;
  };
}

const proficiencyColors: Record<string, { bg: string; text: string }> = {
  expert: { bg: "rgba(16,185,129,0.1)", text: "var(--success)" },
  advanced: { bg: "rgba(79,70,229,0.1)", text: "var(--primary)" },
  intermediate: { bg: "rgba(245,158,11,0.1)", text: "var(--warning)" },
  beginner: { bg: "var(--surface-secondary)", text: "var(--muted)" },
};

export function ParseResult({ data }: ParseResultProps) {
  const { structured: s } = data;

  return (
    <div className="space-y-8">
      {/* Contact */}
      {s.contact && (
        <section>
          <h3 className="mb-3 text-xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            {s.contact.name || "Contact Info"}
          </h3>
          <div className="flex flex-wrap gap-3 text-sm">
            {s.contact.email && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: "var(--surface-secondary)", color: "var(--foreground)" }}>
                <svg className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
                {s.contact.email}
              </span>
            )}
            {s.contact.phone && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: "var(--surface-secondary)", color: "var(--foreground)" }}>
                <svg className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                {s.contact.phone}
              </span>
            )}
            {s.contact.location && (
              <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: "var(--surface-secondary)", color: "var(--foreground)" }}>
                <svg className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                {s.contact.location}
              </span>
            )}
            {s.contact.linkedin && (
              <a href={s.contact.linkedin} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
                style={{ background: "rgba(79,70,229,0.08)", color: "var(--primary)" }}>
                LinkedIn ↗
              </a>
            )}
            {s.contact.github && (
              <a href={s.contact.github} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
                style={{ background: "rgba(79,70,229,0.08)", color: "var(--primary)" }}>
                GitHub ↗
              </a>
            )}
            {s.contact.portfolio && (
              <a href={s.contact.portfolio} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
                style={{ background: "rgba(79,70,229,0.08)", color: "var(--primary)" }}>
                Portfolio ↗
              </a>
            )}
            {s.contact.website && (
              <a href={s.contact.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
                style={{ background: "rgba(79,70,229,0.08)", color: "var(--primary)" }}>
                Website ↗
              </a>
            )}
          </div>
        </section>
      )}

      {/* Summary */}
      {s.summary && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Summary
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.85 }}>
            {s.summary}
          </p>
        </section>
      )}

      {/* Skills */}
      {s.skills && s.skills.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Skills ({s.skills.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {s.skills.map((skill, i) => {
              const colors = proficiencyColors[skill.proficiency || "beginner"];
              return (
                <span
                  key={i}
                  className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold transition-transform hover:scale-[1.03]"
                  style={{ background: colors.bg, color: colors.text }}
                  title={skill.context || undefined}
                >
                  {skill.name}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Experience */}
      {s.experience && s.experience.length > 0 && (
        <section>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Experience
          </h3>
          <div className="space-y-5">
            {s.experience.map((exp, i) => (
              <div
                key={i}
                className="relative pl-5"
                style={{ borderLeft: "2px solid var(--primary-light)" }}
              >
                <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
                <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  {exp.title}
                </p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {exp.company}
                  {exp.location ? ` · ${exp.location}` : ""}
                </p>
                <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--muted)", opacity: 0.7 }}>
                  {exp.startDate || ""}
                  {exp.startDate && (exp.endDate || exp.current) ? " — " : ""}
                  {exp.current ? "Present" : exp.endDate || ""}
                </p>
                {exp.highlights && exp.highlights.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--foreground)", opacity: 0.8 }}>
                    {exp.highlights.map((h, j) => (
                      <li key={j} className="flex gap-2">
                        <span style={{ color: "var(--primary)" }}>•</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
                {exp.achievements && exp.achievements.length > 0 && (
                  <div className="mt-2 rounded-lg p-2.5" style={{ background: "rgba(16,185,129,0.06)" }}>
                    <p className="mb-1 text-xs font-bold" style={{ color: "var(--success)" }}>
                      Key Achievements
                    </p>
                    <ul className="space-y-1 text-xs" style={{ color: "var(--foreground)", opacity: 0.8 }}>
                      {exp.achievements.map((a, j) => (
                        <li key={j} className="flex gap-2">
                          <span style={{ color: "var(--success)" }}>★</span>
                          {a.description}
                          {a.metric && (
                            <span className="font-bold" style={{ color: "var(--success)" }}>
                              ({a.metric})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {exp.technologies && exp.technologies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {exp.technologies.map((tech, j) => (
                      <span
                        key={j}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: "var(--surface-secondary)", color: "var(--muted)" }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {s.education && s.education.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Education
          </h3>
          <div className="space-y-3">
            {s.education.map((edu, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: "var(--surface-secondary)" }}>
                <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  {edu.degree ? `${edu.degree}` : ""}
                  {edu.field ? ` in ${edu.field}` : ""}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {edu.institution}
                  {edu.startDate || edu.endDate
                    ? ` · ${edu.startDate || ""} – ${edu.endDate || ""}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Certifications */}
      {s.certifications && s.certifications.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Certifications
          </h3>
          <div className="space-y-2">
            {s.certifications.map((cert, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />
                <span className="font-semibold" style={{ color: "var(--foreground)" }}>{cert.name}</span>
                {cert.issuer && (
                  <span style={{ color: "var(--muted)" }}>· {cert.issuer}</span>
                )}
                {cert.date && (
                  <span className="text-xs" style={{ color: "var(--muted)", opacity: 0.7 }}>· {cert.date}</span>
                )}
                {cert.credentialUrl && (
                  <a
                    href={cert.credentialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium transition-colors"
                    style={{ color: "var(--primary)" }}
                  >
                    View ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Projects */}
      {s.projects && s.projects.length > 0 && (
        <section>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Projects
          </h3>
          <div className="space-y-4">
            {s.projects.map((proj, i) => (
              <div
                key={i}
                className="relative rounded-lg p-3.5"
                style={{ background: "var(--surface-secondary)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                    {proj.name}
                  </p>
                  {proj.url && (
                    <a
                      href={proj.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium"
                      style={{ color: "var(--primary)" }}
                    >
                      ↗
                    </a>
                  )}
                </div>
                {proj.description && (
                  <p className="mt-1 text-xs" style={{ color: "var(--foreground)", opacity: 0.75 }}>
                    {proj.description}
                  </p>
                )}
                {proj.technologies && proj.technologies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {proj.technologies.map((tech, j) => (
                      <span
                        key={j}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: "rgba(79,70,229,0.08)", color: "var(--primary)" }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
                {proj.highlights && proj.highlights.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs" style={{ color: "var(--foreground)", opacity: 0.8 }}>
                    {proj.highlights.map((h, j) => (
                      <li key={j} className="flex gap-2">
                        <span style={{ color: "var(--primary)" }}>•</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Languages */}
      {s.languages && s.languages.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Languages
          </h3>
          <div className="flex flex-wrap gap-2">
            {s.languages.map((lang, i) => (
              <span key={i} className="rounded-lg px-3 py-1 text-xs font-semibold"
                style={{ background: "var(--surface-secondary)", color: "var(--foreground)" }}>
                {lang}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
