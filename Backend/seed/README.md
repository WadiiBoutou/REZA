# REZA demo seed

Wipes the database and inserts fresh demo data for local dev / onboarding a teammate.

## Run

From `Backend/` (requires `.env` with `DATABASE_URL` and migrations applied):

```bash
npm run seed
```

**Always cleanup first** — safe to re-run, no duplicate rows.

## Logins

| Role | Email | Password | App |
|------|-------|----------|-----|
| Pro admin (Atelier Noor) | `demo.pro@reza.ma` | `demo1234` | reza-pro |
| Superadmin | `superadmin@gmail.com` | `123456` | reza-pro → `/superadmin` |
| B2C client (Nour Benali) | `demo.client@reza.ma` | `demo1234` | reza-client / mobile client |
| Other salon admins | `admin@{subdomain}.ma` | `password123` | one discovery salon each |

## Data included

Mirrors the frontend-only demo on branch `demo`.

- **Atelier Noor** (Casablanca) — pro account. 6 services, 4 employees (Salma, Youssef, Lina, Meryem), 16 clients, 150 appointments from July to October 2026, invoices before 30 Sept 2026, 36 reviews.
- **Seven discovery salons** — Maison Safran, Studio Sable, Ligne Claire, Dar Glow, Le Petit Fauteuil, Miroir Moderne, Nacre Studio. Each has its own account, a slice of the shared service list, and the same four public employees.
- **Nour Benali** — 34 appointments spread across all eight salons, favorites (Atelier Noor, Studio Sable, Le Petit Fauteuil), 28 reviews.

## Structure

```
seed/
  index.ts              # entry: cleanup → seed all
  cleanup.ts            # delete all rows (FK order)
  constants.ts          # passwords, business hours
  superadmin.ts
  subscription-plan.ts  # billing config
  demo-world.ts         # Atelier Noor + discovery salons + Nour Benali
```

## Notes

- **Destructive** — deletes all tenants, users, clients, RDV, etc.
- Does not run automatically on `npm run dev`; run manually when needed.
