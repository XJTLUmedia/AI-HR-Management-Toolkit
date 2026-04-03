import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

interface ResumeResult {
  fileName: string;
  structured: {
    contact: { name: string; email?: string; phone?: string; location?: string; linkedin?: string; github?: string };
    summary?: string;
    skills: Array<{ name: string; category?: string; proficiency?: string }>;
    experience: Array<{ company: string; title: string; startDate?: string; endDate?: string; highlights?: string[] }>;
    education: Array<{ institution: string; degree?: string; field?: string; endDate?: string }>;
    certifications?: Array<{ name: string; issuer?: string; date?: string }>;
    languages?: string[];
  };
}

export async function POST(req: NextRequest) {
  const { format, results } = (await req.json()) as {
    format: "excel" | "pdf" | "json";
    results: ResumeResult[];
  };

  if (!results?.length) {
    return NextResponse.json({ error: "No results to export" }, { status: 400 });
  }

  if (format === "json") {
    const jsonData = JSON.stringify(results, null, 2);
    return new NextResponse(jsonData, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="resumes-export.json"`,
      },
    });
  }

  if (format === "excel") {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summary = workbook.addWorksheet("Summary");
    summary.columns = [
      { header: "File", key: "file", width: 25 },
      { header: "Name", key: "name", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Location", key: "location", width: 20 },
      { header: "Skills Count", key: "skillsCount", width: 14 },
      { header: "Experience Count", key: "expCount", width: 16 },
      { header: "Education Count", key: "eduCount", width: 16 },
      { header: "Top Skills", key: "topSkills", width: 50 },
    ];

    // Style header row
    summary.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    });

    for (const r of results) {
      const s = r.structured;
      summary.addRow({
        file: r.fileName,
        name: s.contact.name,
        email: s.contact.email ?? "",
        phone: s.contact.phone ?? "",
        location: s.contact.location ?? "",
        skillsCount: s.skills.length,
        expCount: s.experience.length,
        eduCount: s.education.length,
        topSkills: s.skills.slice(0, 10).map((sk) => sk.name).join(", "),
      });
    }

    // Skills sheet
    const skillsSheet = workbook.addWorksheet("Skills");
    skillsSheet.columns = [
      { header: "File", key: "file", width: 25 },
      { header: "Name", key: "name", width: 20 },
      { header: "Skill", key: "skill", width: 25 },
      { header: "Category", key: "category", width: 20 },
      { header: "Proficiency", key: "proficiency", width: 15 },
    ];
    skillsSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } };
    });

    for (const r of results) {
      for (const sk of r.structured.skills) {
        skillsSheet.addRow({
          file: r.fileName,
          name: r.structured.contact.name,
          skill: sk.name,
          category: sk.category ?? "",
          proficiency: sk.proficiency ?? "",
        });
      }
    }

    // Experience sheet
    const expSheet = workbook.addWorksheet("Experience");
    expSheet.columns = [
      { header: "File", key: "file", width: 25 },
      { header: "Name", key: "name", width: 20 },
      { header: "Company", key: "company", width: 25 },
      { header: "Title", key: "title", width: 25 },
      { header: "Start", key: "start", width: 14 },
      { header: "End", key: "end", width: 14 },
      { header: "Highlights", key: "highlights", width: 60 },
    ];
    expSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
    });

    for (const r of results) {
      for (const exp of r.structured.experience) {
        expSheet.addRow({
          file: r.fileName,
          name: r.structured.contact.name,
          company: exp.company,
          title: exp.title,
          start: exp.startDate ?? "",
          end: exp.endDate ?? "",
          highlights: exp.highlights?.join("; ") ?? "",
        });
      }
    }

    // Education sheet
    const eduSheet = workbook.addWorksheet("Education");
    eduSheet.columns = [
      { header: "File", key: "file", width: 25 },
      { header: "Name", key: "name", width: 20 },
      { header: "Institution", key: "institution", width: 30 },
      { header: "Degree", key: "degree", width: 20 },
      { header: "Field", key: "field", width: 20 },
      { header: "Year", key: "year", width: 12 },
    ];
    eduSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9333EA" } };
    });

    for (const r of results) {
      for (const edu of r.structured.education) {
        eduSheet.addRow({
          file: r.fileName,
          name: r.structured.contact.name,
          institution: edu.institution,
          degree: edu.degree ?? "",
          field: edu.field ?? "",
          year: edu.endDate ?? "",
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="resumes-export.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(18);
    doc.text("Resume Batch Export", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toISOString().split("T")[0]} | Total: ${results.length} resumes`, 14, 30);

    // Summary table
    const summaryData = results.map((r) => [
      r.fileName,
      r.structured.contact.name,
      r.structured.contact.email ?? "",
      r.structured.contact.phone ?? "",
      `${r.structured.skills.length}`,
      `${r.structured.experience.length}`,
      r.structured.skills.slice(0, 5).map((s) => s.name).join(", "),
    ]);

    autoTable(doc, {
      startY: 36,
      head: [["File", "Name", "Email", "Phone", "Skills", "Exp.", "Top Skills"]],
      body: summaryData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    // Per-resume detail pages
    for (const r of results) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text(r.structured.contact.name, 14, 20);
      doc.setFontSize(9);
      const contactLine = [r.structured.contact.email, r.structured.contact.phone, r.structured.contact.location]
        .filter(Boolean)
        .join(" | ");
      doc.text(contactLine, 14, 27);

      if (r.structured.summary) {
        doc.setFontSize(8);
        const summaryLines = doc.splitTextToSize(r.structured.summary, 265);
        doc.text(summaryLines, 14, 34);
      }

      let yPos = r.structured.summary ? 34 + doc.splitTextToSize(r.structured.summary, 265).length * 4 + 6 : 34;

      // Experience table
      if (r.structured.experience.length) {
        autoTable(doc, {
          startY: yPos,
          head: [["Company", "Title", "Period", "Highlights"]],
          body: r.structured.experience.map((e) => [
            e.company,
            e.title,
            [e.startDate, e.endDate].filter(Boolean).join(" - "),
            e.highlights?.slice(0, 3).join("; ") ?? "",
          ]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [220, 38, 38] },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yPos = (doc as any).lastAutoTable?.finalY + 8 || yPos + 30;
      }

      // Skills list
      if (r.structured.skills.length) {
        autoTable(doc, {
          startY: yPos,
          head: [["Skill", "Category", "Proficiency"]],
          body: r.structured.skills.map((s) => [s.name, s.category ?? "", s.proficiency ?? ""]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [22, 163, 74] },
        });
      }
    }

    const pdfBuffer = doc.output("arraybuffer");
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resumes-export.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format. Use: excel, pdf, json" }, { status: 400 });
}
