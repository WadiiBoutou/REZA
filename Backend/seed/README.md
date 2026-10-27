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
| Pro admin (2 salons) | `admin@spa-royal.ma` | `password123` | reza-pro → dashboard + Mes salons |
| Superadmin | `superadmin@gmail.com` | `123456` | reza-pro → `/superadmin` |
| B2C client | `client1@gmail.com` | `123456` | reza-client / mobile client |
| Single-salon admins | `admin@{subdomain}.ma` | `password123` | discovery venues only |

## Data included

### Spa Royal account (multi-salon)
- **Spa Royal Casablanca** — 3 clients, 4 services, 4 RDV (incl. 2 same hour), employees Sara + Nadia, paid invoices
- **Spa Royal 2** (Rabat) — 2 clients, 3 services, 3 RDV

### Discovery salons (client search)
Salon Élégance, Barber Studio, Beauty Center Chic, Nail Bar Chic, Zen Spa. Each has its own account, admin, services, and one public employee.

## Structure

```
seed/
  index.ts              # entry: cleanup → seed all
  cleanup.ts            # delete all rows (FK order)
  constants.ts          # passwords, business hours
  superadmin.ts
  subscription-plan.ts  # billing config
  spa-royal-account.ts  # multi-salon demo
  discovery-salons.ts   # B2C discovery venues
```

## Notes

- **Destructive** — deletes all tenants, users, clients, RDV, etc.
- Does not run automatically on `npm run dev`; run manually when needed.
