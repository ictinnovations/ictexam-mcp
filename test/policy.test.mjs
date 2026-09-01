/**
 * Config and write-gate tests. Run after build (they import from dist/).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../dist/config.js";
import { registerTools } from "../dist/tools.js";

const base = {
  ICTEXAM_BASE_URL: "https://app.example.com/",
  ICTEXAM_EMAIL: "t@example.com",
  ICTEXAM_PASSWORD: "x",
};

test("loadConfig requires base url, email and password", () => {
  assert.throws(() => loadConfig({}), /ICTEXAM_BASE_URL/);
  assert.throws(() => loadConfig({ ICTEXAM_BASE_URL: "https://x" }), /ICTEXAM_EMAIL/);
});

test("api prefix defaults to /api and can be emptied", () => {
  assert.equal(loadConfig(base).apiPrefix, "/api");
  assert.equal(loadConfig({ ...base, ICTEXAM_API_PREFIX: "" }).apiPrefix, "");
  assert.equal(loadConfig({ ...base, ICTEXAM_API_PREFIX: "v1" }).apiPrefix, "/v1");
});

test("base url trailing slash is trimmed", () => {
  assert.equal(loadConfig(base).baseUrl, "https://app.example.com");
});

test("write is off by default and parsed from truthy strings", () => {
  assert.equal(loadConfig(base).allowWrite, false);
  assert.equal(loadConfig({ ...base, ICTEXAM_MCP_ALLOW_WRITE: "true" }).allowWrite, true);
  assert.equal(loadConfig({ ...base, ICTEXAM_MCP_ALLOW_WRITE: "1" }).allowWrite, true);
});

function collectTools(allowWrite) {
  const names = [];
  const fakeServer = { registerTool: (name) => names.push(name) };
  registerTools(fakeServer, { ...loadConfig(base), allowWrite }, /* client */ {});
  return names;
}

test("read-only install registers only the six read tools", () => {
  const names = collectTools(false);
  assert.deepEqual(new Set(names), new Set([
    "ictexam_list_exams", "ictexam_get_exam", "ictexam_list_classes",
    "ictexam_list_subjects", "ictexam_gradebook", "ictexam_item_analysis",
  ]));
});

test("write install additionally registers the three write tools", () => {
  const names = collectTools(true);
  assert.ok(names.includes("ictexam_parse_question_paper"));
  assert.ok(names.includes("ictexam_publish_exam"));
  assert.ok(names.includes("ictexam_unpublish_exam"));
  assert.equal(names.length, 9);
});
