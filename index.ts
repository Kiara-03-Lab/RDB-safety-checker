#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const SYSTEM_PROMPT = `You are a database deployment safety checker. Analyze the given SQL schema against three constraints and return a structured report.

Constraint 1 — Connection capacity: S = (λ · τ) / (K · 1000)
- L1 Safe: S < 0.7
- L2 Borderline: 0.7 ≤ S ≤ 1.0  
- L3 Failure: S > 1.0

Constraint 2 — Environment variables:
For Vercel: DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL (add DATABASE_MIGRATION_URL if foreign keys exist)
For Railway: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, DATABASE_URL
Flag any foreign keys, extensions (pgvector, PostGIS), or multiple schemas needing extra config.

Constraint 3 — Migration time: estimate complexity score, then seconds = score × 0.8
Scoring: each table +1, each column +0.5, each FK +3, each index +2, TEXT/JSONB/JSON +1.5, BYTEA/BLOB +2, missing PK +5, table >20 cols +5
- L1 Safe: estimate < 50% of T_max
- L2 Borderline: 50–100% of T_max
- L3 Failure: estimate > T_max

Output ONLY valid JSON in this exact shape, no markdown, no explanation:
{
  "overall": "SAFE" | "WARNING" | "FAILURE",
  "tables_detected": number,
  "capacity": {
    "level": "L1" | "L2" | "L3",
    "label": "Safe" | "Borderline" | "Failure",
    "S": number,
    "connections_needed": number,
    "finding": "string",
    "fix": "string"
  },
  "config": {
    "required_vars": ["string"],
    "finding": "string",
    "fix": "string"
  },
  "migration": {
    "level": "L1" | "L2" | "L3",
    "label": "Safe" | "Borderline" | "Failure",
    "estimated_seconds": number,
    "tmax": number,
    "finding": "string",
    "fix": "string"
  },
  "summary": "string"
}`;

const PLATFORMS = ["vercel", "railway", "both"] as const;
type Platform = (typeof PLATFORMS)[number];

interface CheckOptions {
  platform: Platform;
  lambda: number;
  tau: number;
  K: number;
  tmax: number;
}

interface CheckResult {
  overall: "SAFE" | "WARNING" | "FAILURE";
  tables_detected: number;
  capacity: {
    level: string;
    label: string;
    S: number;
    connections_needed: number;
    finding: string;
    fix: string;
  };
  config: {
    required_vars: string[];
    finding: string;
    fix: string;
  };
  migration: {
    level: string;
    label: string;
    estimated_seconds: number;
    tmax: number;
    finding: string;
    fix: string;
  };
  summary: string;
}

function color(text: string, code: number) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

const red = (t: string) => color(t, 31);
const yellow = (t: string) => color(t, 33);
const green = (t: string) => color(t, 32);
const bold = (t: string) => color(t, 1);
const dim = (t: string) => color(t, 2);
const cyan = (t: string) => color(t, 36);

function levelColor(level: string, text: string) {
  if (level === "L1") return green(text);
  if (level === "L2") return yellow(text);
  return red(text);
}

function overallColor(overall: string) {
  if (overall === "SAFE") return green(bold(overall));
  if (overall === "WARNING") return yellow(bold(overall));
  return red(bold(overall));
}

function printReport(result: CheckResult, opts: CheckOptions) {
  console.log("");
  console.log(bold("rdb-safe report"));
  console.log(dim("─".repeat(48)));
  console.log(`Platform:        ${cyan(opts.platform)}`);
  console.log(`Tables detected: ${result.tables_detected}`);
  console.log(`Overall:         ${overallColor(result.overall)}`);
  console.log("");

  console.log(bold("1. Capacity  ") + dim("λ · τ < K"));
  console.log(`   S score:  ${levelColor(result.capacity.level, result.capacity.S.toFixed(3))}  (${result.capacity.level} — ${result.capacity.label})`);
  console.log(`   Need:     ${result.capacity.connections_needed} connections / ${opts.K} available`);
  console.log(`   ${dim(result.capacity.finding)}`);
  if (result.capacity.fix !== "None needed") {
    console.log(`   ${yellow("Fix:")} ${result.capacity.fix}`);
  }
  console.log("");

  console.log(bold("2. Config    ") + dim("V_req ⊆ V_prov"));
  console.log(`   Required:  ${result.config.required_vars.join(", ")}`);
  console.log(`   ${dim(result.config.finding)}`);
  if (result.config.fix !== "None needed") {
    console.log(`   ${yellow("Fix:")} ${result.config.fix}`);
  }
  console.log("");

  console.log(bold("3. Migration ") + dim("∫W(t)dt < T_max"));
  console.log(`   Estimated: ${levelColor(result.migration.level, `~${result.migration.estimated_seconds}s`)}  vs ${opts.tmax}s limit  (${result.migration.level} — ${result.migration.label})`);
  console.log(`   ${dim(result.migration.finding)}`);
  if (result.migration.fix !== "None needed") {
    console.log(`   ${yellow("Fix:")} ${result.migration.fix}`);
  }
  console.log("");

  console.log(dim("─".repeat(48)));
  console.log(result.summary);
  console.log("");
}

function usage() {
  console.log(`
${bold("rdb-safe")} — database deployment safety checker

${bold("Usage:")}
  rdb-safe check <schema.sql> [options]
  cat schema.sql | rdb-safe check [options]

${bold("Options:")}
  --platform  vercel | railway | both  (default: vercel)
  --lambda    peak requests/sec        (default: 50)
  --tau       connection hold ms       (default: 200)
  --K         max DB connections       (default: 20)
  --tmax      deploy timeout seconds   (default: 60)

${bold("Examples:")}
  rdb-safe check schema.sql
  rdb-safe check schema.sql --platform railway --tmax 300
  rdb-safe check schema.sql --lambda 100 --K 25

${bold("Exit codes:")}
  0  SAFE
  1  WARNING
  2  FAILURE
  3  Error (missing API key, bad file, etc.)
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    usage();
    process.exit(0);
  }

  if (args[0] !== "check") {
    console.error(red(`Unknown command: ${args[0]}`));
    usage();
    process.exit(3);
  }

  // Parse options
  const opts: CheckOptions = {
    platform: "vercel",
    lambda: 50,
    tau: 200,
    K: 20,
    tmax: 60,
  };

  let schemaFile: string | null = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--platform") opts.platform = args[++i] as Platform;
    else if (args[i] === "--lambda") opts.lambda = Number(args[++i]);
    else if (args[i] === "--tau") opts.tau = Number(args[++i]);
    else if (args[i] === "--K") opts.K = Number(args[++i]);
    else if (args[i] === "--tmax") opts.tmax = Number(args[++i]);
    else if (!args[i].startsWith("--")) schemaFile = args[i];
  }

  // Read schema from file or stdin
  let schema: string;
  if (schemaFile) {
    const fullPath = path.resolve(schemaFile);
    if (!fs.existsSync(fullPath)) {
      console.error(red(`File not found: ${fullPath}`));
      process.exit(3);
    }
    schema = fs.readFileSync(fullPath, "utf8");
  } else if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    schema = Buffer.concat(chunks).toString("utf8");
  } else {
    console.error(red("No schema provided. Pass a file or pipe via stdin."));
    usage();
    process.exit(3);
  }

  if (!schema.trim()) {
    console.error(red("Schema is empty."));
    process.exit(3);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(red("ANTHROPIC_API_KEY environment variable not set."));
    process.exit(3);
  }

  const client = new Anthropic({ apiKey });

  const userMessage = `Platform: ${opts.platform}
λ = ${opts.lambda} req/s
τ = ${opts.tau} ms
K = ${opts.K} connections
T_max = ${opts.tmax} seconds

Schema:
${schema}`;

  process.stdout.write(dim("Analyzing schema..."));

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  process.stdout.write("\r" + " ".repeat(24) + "\r");

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  let result: CheckResult;
  try {
    result = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    console.error(red("Failed to parse response from Claude."));
    console.error(dim(raw));
    process.exit(3);
  }

  printReport(result, opts);

  const exitCode =
    result.overall === "SAFE" ? 0 : result.overall === "WARNING" ? 1 : 2;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(red(`Error: ${err.message}`));
  process.exit(3);
});
