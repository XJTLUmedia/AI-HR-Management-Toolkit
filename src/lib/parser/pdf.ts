export async function parsePdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return {
      text: result.text.trim(),
      pageCount: result.total,
    };
  } finally {
    await parser.destroy();
  }
}
