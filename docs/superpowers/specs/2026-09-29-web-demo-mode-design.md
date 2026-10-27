# Web Demo Mode Design

## Purpose

Provide a reliable, frontend-only portfolio demonstration of the REZA web app while preserving the existing live Express API integration. The mobile apps are out of scope.

## Deployment behavior

The web app runs in demo mode when `NEXT_PUBLIC_DEMO_MODE=true` or when the URL includes `?demo=true`. A deployed demo exposes clear entry points for client and professional personas and shows a concise notice that the live server is unavailable. Normal production behavior remains available when demo mode is disabled.

## Architecture

The existing API client becomes the live implementation of a small data-provider boundary. A demo implementation provides the same page-facing operations with generated local data and in-memory mutations. Pages and UI components must call the boundary rather than deciding whether to use mock data.

```
page/component -> data-provider -> live API client | demo provider
                                     ^ selected once by demo mode
```

The demo provider is isolated under a dedicated `lib/demo` area. Removing demo mode later consists of deleting that area, the provider selector, and demo-only UI elements; real API-facing pages remain intact.

## Demo data

Seed a varied set of salons, services, employees, clients, appointments, reviews, invoices, and dashboard metrics. Dates are generated relative to the browser date, covering the current calendar month and next calendar month. Therefore a visit in December shows December through January appointments automatically.

## Interaction model

- Client demo: browse listings, authenticate as a seeded client, book, reschedule, or cancel an appointment, and update profile-style state.
- Professional demo: authenticate as a seeded salon administrator, view a populated schedule/dashboard, create and update appointments, and see derived dashboard totals change.
- State is intentionally in-memory: a refresh restores the original seed. No browser persistence, backend, database, external image service, or realtime service is required.
- Image fields use intentionally visible placeholders for later replacement.

## UX and resilience

- Add “Try demo account” actions for client and professional paths.
- Keep the server-status note short and accurate: “Server is not currently available. You are exploring an interactive demo.”
- Do not attempt the live API while explicit demo mode is on, avoiding failed network calls and cold-start waits.
- Existing app functionality outside the selected demo scope continues using its current live API behavior.

## Verification

- Production build succeeds with demo mode enabled and disabled.
- Client and professional entry points land on appropriate populated screens.
- Appointment mutations visibly update relevant lists/totals and reset on refresh.
- Date data covers the current and following calendar month at year boundaries.
