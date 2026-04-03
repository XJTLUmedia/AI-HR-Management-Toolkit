export async function parseText(buffer: Buffer): Promise<{ text: string }> {
  const text = buffer.toString("utf-8").trim();
  if (!text) {
    throw new Error("Empty text file");
  }
  return { text };
}
