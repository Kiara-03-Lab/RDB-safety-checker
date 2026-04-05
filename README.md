# rdb-safety-checker

**Avoid database crashes when launching your app on Vercel or Railway.**

![flowchart](flowchart2003.svg)

Paste your database code into Claude — or run it from your terminal — and get a plain-English report on what will break before you go live.

## Two real scenarios

**Scenario 1 — The silent crash**

Hana launches her booking app on Vercel. Everything works fine in testing. On launch day, 60 people visit at the same time and the app goes down. The error log says "too many connections." She had 20 database connections available but needed 60. rdb-safe would have caught this in 30 seconds and told her to add a connection pooler before launch.

**Scenario 2 — The failed deploy**

Kenji pushes his e-commerce app to Railway. The deploy starts, runs for 70 seconds, then fails with a timeout error. His database setup was too complex to finish within Railway's limit. He has no idea why. rdb-safe would have flagged his large product table and told him to split the setup into two steps.

---

## Option A — Use with Claude.ai (no code needed)

1. Open [claude.ai](https://claude.ai)
2. Copy the prompt file for your platform
3. Paste it into Claude
4. Replace `[PASTE YOUR SQL HERE]` at the bottom with your database code
5. Send — Claude explains what's safe and what to fix

| I am deploying on... | Use this file |
|----------------------|---------------|
| Vercel | `prompt-vercel.md` |
| Railway | `prompt-railway.md` |

---

## Option B — Use as a CLI (for developers)

### Install

```bash
npm install -g rdb-safe
# or without installing:
npx rdb-safe check schema.sql
```

### Setup

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### Usage

```bash
# Basic check
rdb-safe check schema.sql

# Railway with custom limits
rdb-safe check schema.sql --platform railway --tmax 300 --K 100

# Pipe from stdin
cat schema.sql | rdb-safe check --platform vercel
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--platform` | `vercel` | `vercel`, `railway`, or `both` |
| `--lambda` | `50` | Peak requests per second |
| `--tau` | `200` | Connection hold time in ms |
| `--K` | `20` | Max DB connections |
| `--tmax` | `60` | Deploy timeout in seconds |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | SAFE — deploy is fine |
| `1` | WARNING — review before deploying |
| `2` | FAILURE — do not deploy |
| `3` | Error — missing API key, bad file, etc. |

### Add to your deploy workflow

**package.json — blocks deploy automatically**
```json
{
  "scripts": {
    "predeploy": "rdb-safe check schema.sql --platform vercel",
    "deploy": "vercel deploy"
  }
}
```

**GitHub Actions**
```yaml
- name: Check schema safety
  run: npx rdb-safe check schema.sql --platform vercel
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Git pre-push hook** (`.git/hooks/pre-push`)
```bash
#!/bin/sh
npx rdb-safe check schema.sql --platform vercel || exit 1
```

---

## What does it check?

| Problem | What goes wrong without this check |
|---------|-----------------------------------|
| Too many users at once | Your app stops accepting requests |
| Missing settings | App crashes silently on launch |
| Database setup takes too long | Deploy fails halfway through |

---

## Based on

Ishii & Jahangir — *"A Simple Mathematical Boundary for Safe Relational Database Deployment in Serverless Environments"*
https://www.researchgate.net/publication/403518920_A_Simple_Mathematical_Boundary_for_Safe_Relational_Database_Deployment_in_Serverless_Environments
