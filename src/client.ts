/**
 * HTTP client for the ICTExam REST API.
 *
 * ICTExam signs a teacher/admin in with email + password and replies with an
 * HS256 session cookie plus a CSRF cookie. Reads need only the session cookie;
 * writes must echo the CSRF token back in the `x-csrf-token` header. Node's fetch
 * does not persist cookies, so this client tracks them itself.
 *
 * Part of ictexam-mcp by Tahir Almas, ICT Innovations (https://ictinnovations.com).
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { Config } from "./config.js";

export class ICTExamError extends Error {}

export class ICTExamClient {
  private cookies = new Map<string, string>();
  private csrf = "";
  private loggedIn = false;

  constructor(private cfg: Config) {}

  private url(path: string): string {
    return `${this.cfg.baseUrl}${this.cfg.apiPrefix}/${path.replace(/^\/+/, "")}`;
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private storeSetCookies(res: Response): void {
    // undici exposes getSetCookie(); fall back to the single-header form.
    const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
    const raw = typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
    for (const line of raw) {
      const pair = line.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, value);
      if (name === "csrf_token") this.csrf = value;
    }
  }

  private controller(): { signal: AbortSignal; done: () => void } {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), this.cfg.timeoutMs);
    return { signal: c.signal, done: () => clearTimeout(t) };
  }

  private async ensureLogin(): Promise<void> {
    if (this.loggedIn) return;
    const { signal, done } = this.controller();
    let res: Response;
    try {
      res = await fetch(this.url("auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: this.cfg.email, password: this.cfg.password }),
        signal,
      });
    } finally {
      done();
    }
    if (res.status === 401) throw new ICTExamError("Invalid ICTExam credentials");
    if (!res.ok) throw new ICTExamError(`Login failed: HTTP ${res.status}`);
    this.storeSetCookies(res);
    if (this.cookies.size === 0) throw new ICTExamError("Login did not set a session cookie");
    this.loggedIn = true;
  }

  private async request(method: string, path: string, opts: {
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    form?: FormData;
    write?: boolean;
  } = {}): Promise<unknown> {
    await this.ensureLogin();

    let target = this.url(path);
    if (opts.query) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.query)) if (v !== undefined) qs.set(k, String(v));
      const s = qs.toString();
      if (s) target += `?${s}`;
    }

    const headers: Record<string, string> = { Accept: "application/json", Cookie: this.cookieHeader() };
    if (opts.write) {
      if (!this.csrf) throw new ICTExamError("No CSRF token available for a write call");
      headers["x-csrf-token"] = this.csrf;
    }
    let body: string | FormData | undefined;
    if (opts.form) {
      body = opts.form; // fetch sets the multipart boundary itself
    } else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    const { signal, done } = this.controller();
    let res: Response;
    try {
      res = await fetch(target, { method, headers, body, signal });
    } finally {
      done();
    }
    this.storeSetCookies(res);
    const textBody = await res.text();
    if (!res.ok) {
      let detail = textBody;
      try { detail = JSON.parse(textBody).detail ?? textBody; } catch { /* keep text */ }
      throw new ICTExamError(`HTTP ${res.status}: ${detail}`);
    }
    return textBody ? JSON.parse(textBody) : null;
  }

  // ---- reads ------------------------------------------------------------
  listPapers(classId?: number, subjectId?: number) {
    return this.request("GET", "papers", { query: { class_id: classId, subject_id: subjectId } });
  }
  getPaper(assessmentId: number) {
    return this.request("GET", `papers/${assessmentId}`);
  }
  listClasses() {
    return this.request("GET", "classes");
  }
  listSubjects() {
    return this.request("GET", "subjects");
  }
  gradebook(classId?: number, subjectId?: number) {
    return this.request("GET", "teacher/gradebook", { query: { class_id: classId, subject_id: subjectId } });
  }
  itemAnalysis(assessmentId: number) {
    return this.request("GET", "teacher/item-analysis", { query: { assessment_id: assessmentId } });
  }

  // ---- writes -----------------------------------------------------------
  publishPaper(assessmentId: number) {
    return this.request("POST", `papers/${assessmentId}/publish`, { write: true });
  }
  unpublishPaper(assessmentId: number) {
    return this.request("POST", `papers/${assessmentId}/unpublish`, { write: true });
  }

  async parseQuestionPaper(filePath: string, documentType = "mcq_structured", opts: {
    pollIntervalMs?: number; maxWaitMs?: number;
  } = {}): Promise<Record<string, unknown>> {
    const buf = await readFile(filePath);
    const form = new FormData();
    form.append("file", new Blob([buf]), basename(filePath));
    form.append("document_type", documentType);

    const started = (await this.request("POST", "upload-question-file/", {
      query: { wait: "false" }, form, write: true,
    })) as Record<string, unknown>;
    const jobId = started?.job_id as string | undefined;
    if (!jobId) throw new ICTExamError(`Upload did not return a job_id: ${JSON.stringify(started)}`);
    if (started.status === "completed") return started.result as Record<string, unknown>;

    const interval = opts.pollIntervalMs ?? 4000;
    const deadline = Date.now() + (opts.maxWaitMs ?? 240000);
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));
      const job = (await this.request("GET", `parse-jobs/${jobId}`)) as Record<string, unknown>;
      if (job?.status === "completed") return job.result as Record<string, unknown>;
      if (job?.status === "failed") throw new ICTExamError(`Parse failed: ${job.error}`);
    }
    throw new ICTExamError(`Parse job ${jobId} did not finish in time`);
  }
}
