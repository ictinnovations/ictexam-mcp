/**
 * ICTExam tools exposed over MCP.
 *
 * Read tools are always registered. The three write tools — parse a paper (which
 * spends AI credit on the server), publish and unpublish — are only registered
 * when ICTEXAM_MCP_ALLOW_WRITE is set, so a default install cannot change
 * anything on the platform.
 *
 * Part of ictexam-mcp by Tahir Almas, ICT Innovations (https://ictinnovations.com).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.js";
import { ICTExamClient } from "./client.js";
import { json, text, toolError } from "./format.js";

export function registerTools(server: McpServer, cfg: Config, client: ICTExamClient): void {
  // ---- reads (always available) ----------------------------------------
  server.registerTool(
    "ictexam_list_exams",
    {
      title: "List exams",
      description:
        "List exam papers (assessments) on ICTExam: id, title, status (draft/published), class and " +
        "subject. Start here to find an exam's id. Optionally filter by class_id or subject_id.",
      inputSchema: {
        class_id: z.number().int().optional().describe("Optional class id filter."),
        subject_id: z.number().int().optional().describe("Optional subject id filter."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ class_id, subject_id }) => {
      try { return json(await client.listPapers(class_id, subject_id)); } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "ictexam_get_exam",
    {
      title: "Get one exam",
      description: "Get a single exam paper by id: its settings, timing, share links and questions.",
      inputSchema: { assessment_id: z.number().int().describe("The exam paper (assessment) id.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ assessment_id }) => {
      try { return json(await client.getPaper(assessment_id)); } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "ictexam_list_classes",
    {
      title: "List classes",
      description: "List the classes (course groups) defined on ICTExam.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => { try { return json(await client.listClasses()); } catch (e) { return toolError(e); } }
  );

  server.registerTool(
    "ictexam_list_subjects",
    {
      title: "List subjects",
      description: "List the subjects on ICTExam, each tied to a class.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => { try { return json(await client.listSubjects()); } catch (e) { return toolError(e); } }
  );

  server.registerTool(
    "ictexam_gradebook",
    {
      title: "Teacher gradebook",
      description:
        "Get the teacher gradebook: per-exam totals and student marks. Optionally filter by " +
        "class_id or subject_id.",
      inputSchema: {
        class_id: z.number().int().optional().describe("Optional class id filter."),
        subject_id: z.number().int().optional().describe("Optional subject id filter."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ class_id, subject_id }) => {
      try { return json(await client.gradebook(class_id, subject_id)); } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "ictexam_item_analysis",
    {
      title: "Item analysis",
      description:
        "Per-question item analysis for one exam: difficulty, p-value, average mark and how many " +
        "responses were full vs zero credit.",
      inputSchema: { assessment_id: z.number().int().describe("The exam paper (assessment) id.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ assessment_id }) => {
      try { return json(await client.itemAnalysis(assessment_id)); } catch (e) { return toolError(e); }
    }
  );

  if (!cfg.allowWrite) return;

  // ---- writes (only when ICTEXAM_MCP_ALLOW_WRITE is set) ----------------
  server.registerTool(
    "ictexam_parse_question_paper",
    {
      title: "Parse a question paper with AI",
      description:
        "Upload a local PDF or DOCX question paper and have ICTExam extract the questions with AI: " +
        "returns each question's type, text, options, correct answer and marks, plus any mark scheme. " +
        "This spends AI credit on the server.",
      inputSchema: {
        file_path: z.string().describe("Absolute path to a local PDF or DOCX file on this machine."),
        document_type: z.string().optional().describe("Parser mode, default 'mcq_structured'."),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ file_path, document_type }) => {
      try {
        const result = await client.parseQuestionPaper(file_path, document_type ?? "mcq_structured");
        const qs = Array.isArray((result as any)?.parsed_questions) ? (result as any).parsed_questions : [];
        const compact = qs.map((q: any) => ({
          path: q.path, type: q.question_type, max_mark: q.max_mark,
          text: typeof q.text === "string" ? q.text.slice(0, 120) : q.text,
        }));
        return json({
          num_questions: qs.length,
          document_type: (result as any)?.document_type,
          has_mark_scheme: Boolean((result as any)?.mark_scheme),
          questions: compact,
        });
      } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "ictexam_publish_exam",
    {
      title: "Publish an exam",
      description:
        "Publish an exam paper by id so students can take it. Returns the student and teacher share " +
        "URLs. Use ictexam_unpublish_exam to reverse it.",
      inputSchema: { assessment_id: z.number().int().describe("The exam paper (assessment) id.") },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ assessment_id }) => {
      try { return json(await client.publishPaper(assessment_id)); } catch (e) { return toolError(e); }
    }
  );

  server.registerTool(
    "ictexam_unpublish_exam",
    {
      title: "Unpublish an exam",
      description: "Set an exam paper back to draft by id, so students can no longer access it.",
      inputSchema: { assessment_id: z.number().int().describe("The exam paper (assessment) id.") },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ assessment_id }) => {
      try { return json(await client.unpublishPaper(assessment_id)); } catch (e) { return toolError(e); }
    }
  );

  void text; // reserved for future plain-text tool output
}
