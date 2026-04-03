/**
 * MCP Tool: ats_manage_notes
 *
 * Add, list, update, delete, and search notes on candidates.
 */

interface NoteInput {
  content: string;
  author?: string;
}

interface ExistingNote {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

interface CandidateSlice {
  id: string;
  firstName: string;
  lastName: string;
  notes: ExistingNote[];
  [key: string]: unknown;
}

type Action =
  | { type: "add"; candidateId: string; note: NoteInput }
  | { type: "update"; candidateId: string; noteId: string; content: string }
  | { type: "list"; candidateId: string }
  | { type: "delete"; candidateId: string; noteId: string }
  | { type: "search"; query: string; candidateId?: string }
  | { type: "bulk_add"; notes: Array<{ candidateId: string; note: NoteInput }> };

function randomId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export const mcpAtsManageNotesTool = {
  name: "ats_manage_notes",
  description:
    "Manage candidate notes in the ATS. Actions: add (create note on candidate), update (edit note content), list (get all notes for a candidate), delete (remove a note), search (find notes by keyword across one or all candidates), bulk_add (add notes to multiple candidates). Pass the current candidates record.",
  inputSchema: {
    type: "object" as const,
    properties: {
      candidates: {
        type: "object",
        description: "Current candidates record: Record<id, candidateObject>.",
      },
      action: {
        type: "object",
        description:
          'Action to perform. "type": "add" | "update" | "list" | "delete" | "search" | "bulk_add".',
      },
    },
    required: ["candidates", "action"],
  },
  handler(args: {
    candidates: Record<string, CandidateSlice>;
    action: Action;
  }): { content: Array<{ type: "text"; text: string }> } {
    const { candidates, action } = args;

    switch (action.type) {
      case "add": {
        const { candidateId, note } = action;
        const c = candidates[candidateId];
        if (!c) return r({ ok: false, error: `Candidate ${candidateId} not found` });
        if (!note.content?.trim()) return r({ ok: false, error: "Note content is required" });

        const newNote: ExistingNote = {
          id: randomId(),
          content: note.content.trim(),
          author: note.author?.trim() || "MCP User",
          createdAt: nowISO(),
        };
        const updatedCandidate = {
          ...c,
          notes: [...(c.notes || []), newNote],
        };
        return r({
          ok: true,
          noteId: newNote.id,
          note: newNote,
          candidateName: `${c.firstName} ${c.lastName}`,
          candidates: { ...candidates, [candidateId]: updatedCandidate },
          message: `Note added to ${c.firstName} ${c.lastName}`,
        });
      }

      case "update": {
        const { candidateId, noteId, content } = action;
        const c = candidates[candidateId];
        if (!c) return r({ ok: false, error: `Candidate ${candidateId} not found` });
        if (!content?.trim()) return r({ ok: false, error: "Note content is required" });

        const noteIdx = (c.notes || []).findIndex((n) => n.id === noteId);
        if (noteIdx === -1) return r({ ok: false, error: `Note ${noteId} not found` });

        const updatedNote = { ...c.notes[noteIdx], content: content.trim(), updatedAt: nowISO() };
        const updatedNotes = [...c.notes];
        updatedNotes[noteIdx] = updatedNote as ExistingNote;
        const updatedCandidate = { ...c, notes: updatedNotes };
        return r({
          ok: true,
          note: updatedNote,
          candidateName: `${c.firstName} ${c.lastName}`,
          candidates: { ...candidates, [candidateId]: updatedCandidate },
          message: `Note updated for ${c.firstName} ${c.lastName}`,
        });
      }

      case "list": {
        const { candidateId } = action;
        const c = candidates[candidateId];
        if (!c) return r({ ok: false, error: `Candidate ${candidateId} not found` });

        const notes = (c.notes || []).sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt)
        );
        return r({
          ok: true,
          candidateName: `${c.firstName} ${c.lastName}`,
          total: notes.length,
          notes: notes.map((n) => ({
            id: n.id,
            content: n.content,
            author: n.author,
            createdAt: n.createdAt,
          })),
        });
      }

      case "delete": {
        const { candidateId, noteId } = action;
        const c = candidates[candidateId];
        if (!c) return r({ ok: false, error: `Candidate ${candidateId} not found` });

        const existing = (c.notes || []).find((n) => n.id === noteId);
        if (!existing) return r({ ok: false, error: `Note ${noteId} not found` });

        const updatedCandidate = {
          ...c,
          notes: c.notes.filter((n) => n.id !== noteId),
        };
        return r({
          ok: true,
          candidates: { ...candidates, [candidateId]: updatedCandidate },
          message: `Note deleted from ${c.firstName} ${c.lastName}`,
        });
      }

      case "search": {
        const q = action.query.toLowerCase();
        const results: Array<{
          candidateId: string;
          candidateName: string;
          noteId: string;
          content: string;
          author: string;
          createdAt: string;
        }> = [];

        const scope = action.candidateId
          ? { [action.candidateId]: candidates[action.candidateId] }
          : candidates;

        for (const [cid, c] of Object.entries(scope)) {
          if (!c) continue;
          for (const note of c.notes || []) {
            if (
              note.content.toLowerCase().includes(q) ||
              note.author.toLowerCase().includes(q)
            ) {
              results.push({
                candidateId: cid,
                candidateName: `${c.firstName} ${c.lastName}`,
                noteId: note.id,
                content: note.content,
                author: note.author,
                createdAt: note.createdAt,
              });
            }
          }
        }
        results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return r({
          ok: true,
          query: action.query,
          total: results.length,
          results,
        });
      }

      case "bulk_add": {
        const updated = { ...candidates };
        const results: Array<{ candidateId: string; ok: boolean; noteId?: string; error?: string }> = [];

        for (const item of action.notes) {
          const c = updated[item.candidateId];
          if (!c) {
            results.push({ candidateId: item.candidateId, ok: false, error: "Not found" });
            continue;
          }
          if (!item.note.content?.trim()) {
            results.push({ candidateId: item.candidateId, ok: false, error: "Empty content" });
            continue;
          }
          const newNote: ExistingNote = {
            id: randomId(),
            content: item.note.content.trim(),
            author: item.note.author?.trim() || "MCP User",
            createdAt: nowISO(),
          };
          updated[item.candidateId] = {
            ...c,
            notes: [...(c.notes || []), newNote],
          };
          results.push({ candidateId: item.candidateId, ok: true, noteId: newNote.id });
        }

        return r({
          ok: true,
          candidates: updated,
          results,
          message: `Added ${results.filter((r) => r.ok).length} notes across candidates`,
        });
      }

      default:
        return r({ ok: false, error: `Unknown action type: ${(action as Action).type}` });
    }
  },
};

function r(data: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
