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
| Pro admin Spa Royal (2 salons) | `admin@spa-royal.ma` | `password123` | reza-pro → dashboard + Mes salons |
| Pro admin Reza (2 salons) | `admin@reza.com` | `123456` | reza-pro → dashboard + Mes salons |
| Superadmin | `superadmin@gmail.com` | `123456` | reza-pro → `/superadmin` |
| B2C client | `client1@gmail.com` | `123456` | reza-client / mobile client |

## Data included

### Accounts (multi-salon)

- **Spa Royal account**
  - **Spa Royal Casablanca** — 6 services, 6 clients (incl. Client Demo `client1@gmail.com`), 5 employees (Sara Benali, Nadia Tazi, Karim Ouazzani, Salma El Fassi, Hicham Alaoui)
  - **Spa Royal 2 (Rabat)** — 3 services, 2 clients, 1 employee (Laila Moussaoui)
- **Reza account**
  - **Reza Salon Casablanca** — 4 services, 2 employees (Rachid Tazi, Sofia Alaoui)
  - **Reza Salon Rabat** — 3 services, 1 employee (Karim Idrissi)

### Base entities

- Clients (with demo client `client1@gmail.com` + password), employees with staff users and selective service links (`serviceIndices`), services, tenant settings, subscription plan, active subscriptions, approved/pending reviews, family members, SUBSCRIPTION invoice.
- **Booking rule** : chaque salon applique un `bookingDelay` de **1 jour** (`{ value: '1', unit: 'jours', allowLastMoment: false }`) — les créneaux à moins de 24 h sont masqués côté client.

**No appointments, no SALE invoices, no cash transactions, no notifications** — the seed stays clean so booking / caisse features can be tested from a fresh slate.

## Structure

```
seed/
  index.ts              # entry: cleanup → seed all
  cleanup.ts            # delete all rows (FK order)
  constants.ts          # passwords, business hours, bookingDelay, avatar URLs
  superadmin.ts         # superadmin@gmail.com
  subscription-plan.ts  # base plan
  reza-account.ts       # Reza multi-salon demo
  spa-royal-account.ts  # Spa Royal multi-salon demo
```

## Notes

- **Destructive** — deletes all tenants, users, clients, RDV, etc.
- Does not run automatically on `npm run dev`; run manually when needed.
