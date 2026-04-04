export const exportResultsTool = {
  name: "export_results",
  description:
    "Export parsed resume results to a specified format (JSON, CSV, or Markdown). Accepts an array of structured resume results and returns formatted output.",
  inputSchema: {
    type: "object" as const,
    properties: {
      results: {
        type: "array",
        description: "Array of parsed resume results with fileName and structured data",
        items: {
          type: "object",
          properties: {
            fileName: { type: "string" },
            structured: { type: "object" },
          },
          required: ["fileName", "structured"],
        },
      },
      format: {
        type: "string",
        enum: ["json", "csv", "markdown"],
        description: "Export format: json, csv, or markdown",
      },
    },
    required: ["results", "format"],
  },
  handler: async (args: {
    results: Array<{
      fileName: string;
      structured: {
        contact?: { name?: string; email?: string; phone?: string; location?: string };
        skills?: Array<{ name: string; category?: string; proficiency?: string }>;
        experience?: Array<{ company: string; title: string; startDate?: string; endDate?: string }>;
        education?: Array<{ institution: string; degree?: string; field?: string }>;
      };
    }>;
    format: "json" | "csv" | "markdown";
  }) => {
    if (args.format === "json") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(args.results, null, 2),
          },
        ],
      };
    }

    if (args.format === "markdown") {
      const sections = args.results.map((r) => {
        const c = r.structured.contact ?? {};
        const skills = r.structured.skills ?? [];
        const exp = r.structured.experience ?? [];
        const edu = r.structured.education ?? [];
        const lines: string[] = [];
        lines.push(`## ${c.name ?? r.fileName}`);
        const contactParts = [c.email, c.phone, c.location].filter(Boolean);
        if (contactParts.length) lines.push(contactParts.join(" · "));
        lines.push("");
        if (skills.length) {
          lines.push("### Skills");
          lines.push(`| Skill | Category | Proficiency |`);
          lines.push(`|-------|----------|-------------|`);
          for (const s of skills) {
            lines.push(`| ${s.name} | ${s.category ?? ""} | ${s.proficiency ?? ""} |`);
          }
          lines.push("");
        }
        if (exp.length) {
          lines.push("### Experience");
          for (const e of exp) {
            const period = [e.startDate, e.endDate].filter(Boolean).join(" – ");
            lines.push(`- **${e.title}** @ ${e.company}${period ? ` (${period})` : ""}`);
          }
          lines.push("");
        }
        if (edu.length) {
          lines.push("### Education");
          for (const e of edu) {
            lines.push(`- ${[e.degree, e.field].filter(Boolean).join(", ")} — ${e.institution}`);
          }
          lines.push("");
        }
        return lines.join("\n");
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `# Resume Export (${args.results.length} candidates)\n\n${sections.join("\n---\n\n")}`,
          },
        ],
      };
    }

    // CSV format - summary table
    const header = "File,Name,Email,Phone,Location,Skills Count,Experience Count,Top Skills";
    const rows = args.results.map((r) => {
      const c = r.structured.contact ?? {};
      const skills = r.structured.skills ?? [];
      const exp = r.structured.experience ?? [];
      const escapeCsv = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
      return [
        escapeCsv(r.fileName),
        escapeCsv(c.name ?? ""),
        escapeCsv(c.email ?? ""),
        escapeCsv(c.phone ?? ""),
        escapeCsv(c.location ?? ""),
        skills.length,
        exp.length,
        escapeCsv(skills.slice(0, 8).map((s) => s.name).join(", ")),
      ].join(",");
    });

    return {
      content: [
        {
          type: "text" as const,
          text: [header, ...rows].join("\n"),
        },
      ],
    };
  },
};
