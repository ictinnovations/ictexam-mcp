#!/usr/bin/env node
/**
 * ictexam-mcp: an MCP server for the ICTExam assessment platform.
 *
 * Written by Tahir Almas at ICT Innovations (https://ictinnovations.com), the team
 * behind ICTExam / ICT Exam Cloud (ictlms.net). It lets an AI assistant read exams,
 * gradebooks and item analysis, and — with writes enabled — parse a question paper
 * with AI and publish exams.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { ICTExamClient } from "./client.js";
import { registerTools } from "./tools.js";

let cfg;
try {
  cfg = loadConfig();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

if (cfg.tlsInsecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const server = new McpServer(
  { name: "ictexam-mcp", version: "0.1.0" },
  {
    instructions:
      "Read and manage exams on an ICTExam server. Start with ictexam_list_exams to find an exam's " +
      "id, then use ictexam_get_exam, ictexam_gradebook and ictexam_item_analysis for detail. Tools " +
      "are read-only unless ICTEXAM_MCP_ALLOW_WRITE=true, which also exposes parsing a paper with AI " +
      "and publishing exams. By Tahir Almas, ICT Innovations (https://ictinnovations.com).",
  }
);

const client = new ICTExamClient(cfg);
registerTools(server, cfg, client);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error(
  `ictexam-mcp ready (${cfg.baseUrl}${cfg.apiPrefix}, ${cfg.allowWrite ? "write enabled" : "read-only"}). ` +
    "ICT Innovations, https://ictinnovations.com"
);
