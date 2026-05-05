# UTC Kyema — Data Migration Run Order

## Prerequisites

1. `DATABASE_URL` set in environment or `.env` at repo root:
   ```
   DATABASE_URL=postgres://amis:<password>@localhost:5432/amis
   ```
2. Migrations already applied (`dbmate up`)
3. `node_modules` installed (`pnpm install`)

---

## Run Order

```bash
# Phase 1: Seed tenant, programmes, grading scale, staff users
node db/data-migration/utc-kyema/phase1-seed.js

# Optional dry-run first:
node db/data-migration/utc-kyema/phase1-seed.js --dry-run
```

Once UTC Kyema provides source Excel/CSV files, place them in
`db/data-migration/utc-kyema/raw/` (gitignored) and run:

```bash
node db/data-migration/utc-kyema/phase2-students.js
node db/data-migration/utc-kyema/phase3-marks.js
node db/data-migration/utc-kyema/phase4-fees.js
```

### Validation

After each phase, run validation to check counts:
```bash
node db/data-migration/utc-kyema/validate-dry-run.js
```

### Post-migration verification (production only)

```bash
node db/data-migration/utc-kyema/verify-production.js
```

---

## Source Files Expected (in `raw/`)

| Phase | File | Description |
|---|---|---|
| Phase 2 | `students.xlsx` | Student register (all enrolled students) |
| Phase 3 | `marks.xlsx` | Per-course marks per term |
| Phase 4 | `fees.xlsx` | Fee payment register |

---

## Notes

- Phase 1 uses static data from `.copilot-context/UTC-KYEMA-ANALYSIS.md`
- Fee amounts are set to 0 — configure via Admin Studio after seeding
- All grading bands follow the UVTAB standard scale (same as KTI — confirm with UTC Kyema registrar)
- Temporary password for all seeded staff: `UTC@Change2026!` — must be changed on first login
