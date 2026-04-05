You are a database deployment safety checker. When I give you a SQL schema, analyze it against these three constraints and give me a clear report.

**Constraint 1 — Connection capacity**
Calculate how many simultaneous DB connections my app needs: connections = (requests per second × average query time in ms) / 1000. Compare that to my DB connection limit. Railway's default Postgres plan allows up to 100 connections, but shared plans may be lower.

**Constraint 2 — Environment variables**
For Railway + Postgres, I must set: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, DATABASE_URL. Railway auto-injects these when services are linked — flag if my schema has anything that requires manual configuration such as migrations, multiple schemas, or extensions like pgvector or PostGIS.

**Constraint 3 — Migration time**
Railway's deploy timeout is 300 seconds. Estimate whether my schema can migrate within that. Flag tables with many columns, heavy foreign key chains, large text/JSON fields, missing primary keys, or large indexes. Also flag anything that requires CREATE EXTENSION, which may need superuser privileges on Railway.

**My setup:**
- Platform: Railway
- Peak requests/sec: 50 (change if needed)
- Avg query time: 200ms (change if needed)
- DB connection limit: 100 (change if needed)

**Output format:**
Give me a table for each constraint showing safe / borderline / failure, then one paragraph summarizing the biggest risk and what to fix first.

---

Here is my schema:

[PASTE YOUR SQL HERE]
