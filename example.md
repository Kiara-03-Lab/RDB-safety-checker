# rdb-safe example output

Schema used:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  total DECIMAL(10,2),
  status VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2)
);
```

Platform: Vercel · λ=50 · τ=200ms · K=20 · T_max=60s

---

## rdb-safe report

**Platform:** Vercel
**Tables detected:** 3
**Overall:** WARNING

---

### 1. Capacity — λ · τ < K

| Parameter | Value |
|-----------|-------|
| λ (req/s) | 50 |
| τ (ms) | 200 |
| K (connections) | 20 |
| Connections needed | 10 |
| S score | 0.50 |
| Level | L1 — Safe |

**Finding:** At 50 req/s with 200ms average query time, your app needs ~10 simultaneous connections against a limit of 20. You have comfortable headroom right now.

**Fix:** None needed. If you expect traffic to double, add PgBouncer or Prisma Accelerate before scaling.

---

### 2. Config mapping — V_req ⊆ V_prov

| Variable | Required | Reason |
|----------|----------|--------|
| DATABASE_URL | yes | base connection string |
| POSTGRES_URL | yes | Vercel Postgres SDK |
| POSTGRES_PRISMA_URL | yes | Prisma on Vercel |
| DATABASE_MIGRATION_URL | yes | schema has foreign keys requiring migration coordination |

**Finding:** 2 foreign key relationships detected (orders → users, order_items → orders). Migration order matters — users must exist before orders, orders before order_items.

**Fix:** Set all 4 variables in your Vercel project settings before first deploy. Run migrations in dependency order or use a tool like Prisma Migrate that handles this automatically.

---

### 3. Migration time — ∫W(t)dt < T_max

| Metric | Value |
|--------|-------|
| Complexity score | 18.5 |
| Estimated migration time | ~15s |
| T_max | 60s |
| Level | L1 — Safe |

**Schema breakdown:**
- `users`: 3 cols, 0 FKs — clean
- `orders`: 6 cols, 1 FK, TEXT field — minor slowdown risk from TEXT column
- `order_items`: 5 cols, 1 FK — clean

**Finding:** Schema is lightweight. Estimated 15s migration is well within Vercel's 60s timeout.

**Fix:** None needed. The `notes TEXT` column in orders could grow large over time — if you later add a full-text search index on it, run that separately with `CREATE INDEX CONCURRENTLY` outside the deploy step.

---

### Summary

This schema is safe to deploy on Vercel. The only active concern is ensuring all 4 environment variables are set before first deploy — missing any one of them will cause a silent connection failure at runtime. Connection capacity and migration time are both well within safe limits for your current traffic assumptions. If peak requests exceed ~70/s in future, revisit the connection pool sizing.
