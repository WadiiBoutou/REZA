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
| Reza account admin | `admin@reza.com` | `123456` | reza-pro → dashboard + Mes salons |
| Superadmin | `superadmin@gmail.com` | `123456` | reza-pro → `/superadmin` |
| B2C client | `client1@gmail.com` | `123456` | reza-client / mobile client |

## Data included

### Accounts (multi-salon)
- **Spa Royal account** — Spa Royal Casablanca (6 services, 6 clients incl. Client Demo, 5 employees) + Spa Royal 2 (Rabat)
- **Reza account** — Reza Salon Casablanca + Reza Salon Rabat

### Base entities
- Clients (with demo client `client1@gmail.com` + password), employees with staff users and selective service links, services, tenant settings, subscription plan, active subscriptions, approved/pending reviews, family members, SUBSCRIPTION invoice.

**No appointments, no SALE invoices, no cash transactions, no notifications** — the seed stays clean so booking / caisse features can be tested from a fresh slate.

## Structure

```
seed/
  index.ts              # entry: cleanup → seed all
  cleanup.ts            # delete all rows (FK order)
  constants.ts          # passwords, business hours, avatar URLs
  superadmin.ts         # superadmin@gmail.com
  subscription-plan.ts  # base plan
  reza-account.ts       # Reza multi-salon demo
  spa-royal-account.ts  # Spa Royal multi-salon demo
```

## Notes

- **Destructive** — deletes all tenants, users, clients, RDV, etc.
- Does not run automatically on `npm run dev`; run manually when needed.
