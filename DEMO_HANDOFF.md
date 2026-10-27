# REZA Web Demo Handoff

## Purpose

This workspace keeps the real Express/PostgreSQL backend and provides separate browser-only demo modes for the customer and professional Next.js apps. Mobile apps are out of the demo scope. The demo is intended to be predictable on Vercel without a running backend, database, or Socket.IO server.

## Projects

| App | Root | Demo entry |
| --- | --- | --- |
| Customer web | `Web/reza-client` | `/login`, then **Try demo account**; also supports `?demo=true` |
| Professional web | `Web/reza-pro` | `/login`, then **Try demo account**; also supports `?demo=true` |
| Backend | `Backend` | Preserved for live/full-stack use; bypassed in demo mode |

Run either web project from its own folder with `npm install` and `npm run dev`. Set the Vercel project root to the corresponding web folder. Demo deployments set `NEXT_PUBLIC_DEMO_MODE=true`; no backend URL or credentials are required in that mode.

## Demo Selection

Each app retains its existing `lib/api.ts` as the page-facing API boundary and selects a dedicated `lib/demo-api.ts` implementation when demo mode is active. Selection is enabled by `NEXT_PUBLIC_DEMO_MODE=true`, `?demo=true`, or the login button. Login activation is scoped to the current browser tab with `sessionStorage`.

Normal mode continues through the existing live fetch client. The professional realtime helper returns no Socket.IO connection in demo mode. Demo mutations dispatch a `reza-demo-update` browser event; each app provider remounts page content for its own event. Demo domain data is held in module memory, so refresh restores seeds. Fake auth tokens/profile storage are separate from demo business state.

```text
Customer pages -> Web/reza-client/lib/api.ts -> live backend OR demo-api.ts
Professional pages -> Web/reza-pro/lib/api.ts -> live backend OR demo-api.ts
                                                    |
                                        in-memory seeds + browser events
```

## Accounts

| Role | Email | Password | App |
| --- | --- | --- | --- |
| Customer | `demo.client@reza.ma` | `demo1234` | `Web/reza-client` |
| Salon admin | `demo.pro@reza.ma` | `demo1234` | `Web/reza-pro` |

The login pages show “Demo mode · server is not currently available.” In the professional dashboard sidebar the title changes to “Reza Demo.” No staff or superadmin demo accounts are defined.

## Seeded Data

The customer demo has eight salons, service catalogs, employee listings, reviews, favorites, and upcoming appointments. Salon imagery is intentionally blank so replacement images can be added later.

The professional demo has one seeded salon, four employee records (not staff accounts), 16 clients (including guest records and inactive clients), 48 appointments, 36 reviews across pending/approved/rejected states, 12 invoices, services, and derived statistics. Some appointments contain two or three service assignments with per-service employees. Their dates are generated relative to the visitor's current date through the end of the following calendar month, including across year boundaries.

## Covered Professional Views

- Agenda at `/dashboard/rendez-vous`, including multi-service appointment cards. Booking-level actions (confirm and overflow menu) belong to the first/top service card only.
- Client records at `/dashboard/clients/fichier-client/gestion`, with guest/status filters and 12 clients per page.
- Reviews at `/dashboard/clients/mes-avis/avis-a-moderer`, `/avis-moderes`, and `/avis-refuses`; the pending list paginates at 12. Approval, rejection, restore, and deletion update in-memory state.
- Client statistics at `/dashboard/clients/statistiques/avis`, `/frequences-globales`, `/meilleurs-clients`, and `/nouveaux-clients`.
- Employee statistics at `/dashboard/personels/statistiques` and `/dashboard/personels/taux-occupation`.
- Caisse at `/dashboard/caisse`, including service/employee columns and expandable invoice line items for multi-service sessions.

The customer demo supports salon discovery/detail, services, reviews, booking, client account appointments, cancellations, and favorites through the existing client API methods.

## Important Implementation Files

- `Web/reza-pro/lib/demo-mode.ts`: activation flag and fake admin credentials.
- `Web/reza-pro/lib/demo-api.ts`: professional seeds, API response adapter, mutations, and derived staff/review/client metrics.
- `Web/reza-pro/lib/realtime.ts`: disables Socket.IO creation during demo mode.
- `Web/reza-client/lib/demo-mode.ts`: activation flag and fake customer credentials.
- `Web/reza-client/lib/demo-api.ts`: customer salon/booking seeds and in-memory endpoints.
- `Web/reza-pro/app/dashboard/rendez-vous/AppointmentCard.tsx`: per-service agenda card; only service index zero renders booking-level actions.

## Validation Notes

The staff pages, client/review pages, caisse rows, customer booking flow, and multi-service agenda/caisse rendering have been checked in the browser during implementation. Type diagnostics and `git diff --check` passed on touched slices. A clean whole-app production build was not reliably captured because the shared PowerShell terminal interrupted build commands; rerun `npm run build` from each web app folder for a fresh production-build result.

## Known Limits

- Demo mutations are temporary and reset on refresh; they are not visitor-persistent.
- Image fields are placeholders.
- This adapter intentionally supports the portfolio/demo flows rather than every backend endpoint. When adding a page to demo scope, check its API methods in that app's `lib/api.ts` and add corresponding adapter responses.
- The app READMEs are the deployment-facing guides. This root file is the cross-app handoff/current-state summary.