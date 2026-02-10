import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const notesPath = path.join(__dirname, "..", "notes.md");

const server = new McpServer({ name: "codex-notes", version: "0.1.0" });

server.registerTool(
  "add_note",
  {
    title: "Add Note",
    description: "Append a note to notes.md",
    inputSchema: { text: z.string().min(1) },
    outputSchema: { ok: z.boolean(), bytesWritten: z.number() }
  },
  async ({ text }) => {
    const entry = `- ${new Date().toISOString()} ${text}\n`;
    const buffer = Buffer.from(entry, "utf8");
    await fs.appendFile(notesPath, buffer);
    return {
      content: [{ type: "text", text: "Nota guardada." }],
      structuredContent: { ok: true, bytesWritten: buffer.length }
    };
  }
);

await server.connect(new StdioServerTransport());
