# ictexam-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for
**[ICTExam](https://www.ictlms.net)**, the AI exam authoring, delivery and
auto-grading platform from [ICT Innovations](https://ictinnovations.com).

It lets an AI assistant read your exams, gradebooks and per-question item
analysis, and — only when you turn writes on — parse a question paper into a
structured exam with AI and publish exams to students.

## Install

Run it straight from npm with `npx`, or install it globally:

```bash
npx -y ictexam-mcp      # no install
npm install -g ictexam-mcp
```

Requires Node.js 18 or newer.

## Configure

Set these in your MCP client's server config (or a `.env`):

| Variable | Required | Default | |
|----------|----------|---------|--|
| `ICTEXAM_BASE_URL` | yes | | Your site, e.g. `https://app.ictlms.net` (no trailing `/api`) |
| `ICTEXAM_EMAIL` | yes | | A teacher or admin account |
| `ICTEXAM_PASSWORD` | yes | | Password for that account |
| `ICTEXAM_API_PREFIX` | no | `/api` | API mount path; set empty to hit the backend port directly |
| `ICTEXAM_MCP_ALLOW_WRITE` | no | `false` | Unlock the write tools (see Safety) |
| `ICTEXAM_TIMEOUT_MS` | no | `60000` | Per-request timeout (AI parsing can be slow) |
| `ICTEXAM_TLS_INSECURE` | no | `false` | Skip TLS verification — self-signed test servers only |

### Claude Desktop example

```json
{
  "mcpServers": {
    "ictexam": {
      "command": "npx",
      "args": ["-y", "ictexam-mcp"],
      "env": {
        "ICTEXAM_BASE_URL": "https://app.ictlms.net",
        "ICTEXAM_EMAIL": "teacher@example.com",
        "ICTEXAM_PASSWORD": "your-password"
      }
    }
  }
}
```

## Tools

Read tools are always available:

| Tool | What it does |
|------|--------------|
| `ictexam_list_exams` | List exam papers (id, title, status, class, subject) |
| `ictexam_get_exam` | One paper's settings, share links and questions |
| `ictexam_list_classes` | Classes (course groups) |
| `ictexam_list_subjects` | Subjects, each tied to a class |
| `ictexam_gradebook` | Per-exam totals and student marks |
| `ictexam_item_analysis` | Per-question difficulty, p-value and average mark |

Write tools appear only when `ICTEXAM_MCP_ALLOW_WRITE=true`:

| Tool | What it does |
|------|--------------|
| `ictexam_parse_question_paper` | Upload a local PDF/DOCX and AI-extract the questions |
| `ictexam_publish_exam` | Publish a paper; returns student and teacher share URLs |
| `ictexam_unpublish_exam` | Set a paper back to draft |

## Safety

The server is **read-only by default**. The three write tools are not registered
at all unless you set `ICTEXAM_MCP_ALLOW_WRITE=true`, so a default install cannot
change anything on the platform. Parsing a paper spends AI credit on the server,
and publishing makes an exam live for students — both sit behind that switch on
purpose. The client authenticates with the account's own session cookie and
echoes the CSRF token on writes, exactly as the web app does; it never stores or
logs your password beyond the environment you give it.

## How it connects

ICTExam runs a FastAPI backend. The server signs in once with your email and
password, keeps the session cookie for the life of the process, and talks to the
REST API under `/api` (configurable). No API key to provision.

## About

Built by Tahir Almas at [ICT Innovations](https://ictinnovations.com) — the team
behind ICTExam, ICTContact, ICTDialer, ICTFax and ICTPBX. ICTExam ships with a
native Moodle activity module (LTI 1.3, grade passback and roster sync); learn
more at [ictlms.net](https://www.ictlms.net).

MIT licensed. Issues and PRs welcome at
[github.com/ictinnovations/ictexam-mcp](https://github.com/ictinnovations/ictexam-mcp).
