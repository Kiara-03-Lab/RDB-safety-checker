# rdb-safe CLI

Terminal checker for database deployment safety. Blocks deploys automatically if your schema is unsafe.

## Install

```bash
npm install -g rdb-safe
# or use without installing:
npx rdb-safe check schema.sql
```

## Setup

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

```bash
# Basic check
rdb-safe check schema.sql

# Railway with custom limits
rdb-safe check schema.sql --platform railway --tmax 300 --K 100

# Pipe from stdin
cat schema.sql | rdb-safe check --platform vercel
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--platform` | `vercel` | `vercel`, `railway`, or `both` |
| `--lambda` | `50` | Peak requests per second |
| `--tau` | `200` | Connection hold time in ms |
| `--K` | `20` | Max DB connections |
| `--tmax` | `60` | Deploy timeout in seconds |

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | SAFE — deploy is fine |
| `1` | WARNING — review before deploying |
| `2` | FAILURE — do not deploy |
| `3` | Error — missing API key, bad file, etc. |

## Add to your deploy workflow

**package.json**
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
