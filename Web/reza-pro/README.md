This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## REZA Professional Demo

The Express/PostgreSQL backend remains in `../../Backend`. Normal mode continues to use the live API through `lib/api.ts`; the opt-in portfolio demo routes that same boundary to the isolated `lib/demo-api.ts` adapter.

Demo data is generated in the browser and needs no backend, database credentials, Socket.IO, or external image service. It includes 48 appointments, client records, services, an employee roster (not staff accounts), reviews, invoices, and dashboard totals. Appointment dates cover the current and following calendar month and advance automatically. Mutations are in memory and reset after refresh. Image fields are blank placeholders.

Enable the demo with `NEXT_PUBLIC_DEMO_MODE=true`, `?demo=true`, or the **Try demo account** button on `/login`. Set the Vercel project root to `Web/reza-pro`; demo mode needs no backend environment variables.

| Account | Email | Password | Demo focus |
| --- | --- | --- | --- |
| Salon admin | `demo.pro@reza.ma` | `demo1234` | Agenda, appointments, clients, services, reviews, invoices |

```text
Professional pages -> lib/api.ts -> live Express API (normal mode)
							  \-> lib/demo-api.ts (selected demo mode)
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
