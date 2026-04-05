# rdb-safe

Check if your database schema is safe to deploy — before it breaks in production.

## How to use

1. Open [claude.ai](https://claude.ai)
2. Open the prompt file for your platform
3. Copy the entire contents and paste into Claude
4. Replace `[PASTE YOUR SQL HERE]` with your schema
5. Send — Claude will tell you what's safe and what to fix

## Prompts

| File | Platform |
|------|----------|
| `prompt-vercel.md` | Vercel |
| `prompt-railway.md` | Railway |

## What it checks

| Check | What it catches |
|-------|----------------|
| Connection capacity | Too many requests overwhelming your DB connection limit |
| Environment variables | Missing config that causes silent failures at deploy time |
| Migration time | Schema too large to migrate within the platform timeout |

## Based on

Ishii & Jahangir — *"A Simple Mathematical Boundary for Safe Relational Database Deployment in Serverless Environments"*
