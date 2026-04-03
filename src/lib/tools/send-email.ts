import nodemailer from "nodemailer";

export const sendEmailTool = {
  name: "send_email",
  description:
    "Send parsed resume results via email using SMTP. Requires SMTP configuration (host, port, user, pass) and recipient email. Sends an HTML summary of all results.",
  inputSchema: {
    type: "object" as const,
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject (optional)" },
      smtpHost: { type: "string", description: "SMTP server host" },
      smtpPort: { type: "number", description: "SMTP server port (default: 587)" },
      smtpSecure: { type: "boolean", description: "Use TLS (default: false)" },
      smtpUser: { type: "string", description: "SMTP username/email" },
      smtpPass: { type: "string", description: "SMTP password or app password" },
      results: {
        type: "array",
        description: "Array of resume results to include",
        items: {
          type: "object",
          properties: {
            fileName: { type: "string" },
            structured: { type: "object" },
          },
        },
      },
    },
    required: ["to", "smtpHost", "smtpUser", "smtpPass", "results"],
  },
  handler: async (args: {
    to: string;
    subject?: string;
    smtpHost: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser: string;
    smtpPass: string;
    results: Array<{
      fileName: string;
      structured: Record<string, unknown>;
    }>;
  }) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.to)) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid recipient email" }) }],
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: args.smtpHost,
        port: args.smtpPort || 587,
        secure: args.smtpSecure ?? false,
        auth: { user: args.smtpUser, pass: args.smtpPass },
      });

      let html = `<h2>Resume Batch Results</h2><p>Total: ${args.results.length} resumes</p><hr/>`;

      for (const r of args.results) {
        const contact = r.structured.contact as Record<string, string> | undefined;
        const skills = r.structured.skills as Array<{ name: string }> | undefined;
        const experience = r.structured.experience as Array<{ company: string; title: string }> | undefined;

        html += `<div style="margin:12px 0;padding:10px;border:1px solid #ddd;border-radius:6px;">
<h3>${contact?.name ?? r.fileName}</h3>
<p>${[contact?.email, contact?.phone, contact?.location].filter(Boolean).join(" · ")}</p>
<p><b>Skills (${skills?.length ?? 0}):</b> ${skills?.slice(0, 10).map((s) => s.name).join(", ") ?? "N/A"}</p>
<p><b>Experience (${experience?.length ?? 0}):</b> ${experience?.slice(0, 3).map((e) => `${e.title} @ ${e.company}`).join("; ") ?? "N/A"}</p>
</div>`;
      }

      await transporter.sendMail({
        from: args.smtpUser,
        to: args.to,
        subject: args.subject || `Resume Batch Results (${args.results.length} resumes)`,
        html,
        attachments: [
          {
            filename: "resumes-export.json",
            content: JSON.stringify(args.results, null, 2),
          },
        ],
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: `Email sent to ${args.to}` }) }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: err instanceof Error ? err.message : "Failed to send email" }),
          },
        ],
      };
    }
  },
};
