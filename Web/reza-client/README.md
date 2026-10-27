This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## REZA Client Demo

The opt-in portfolio demo uses the existing `lib/api.ts` boundary and an isolated `lib/demo-api.ts` provider. Normal mode continues to call the production API; demo mode needs no backend, database credentials, or external image service.

The browser seed contains eight salons, service and employee catalogs, reviews, and client appointments. Dates cover the current and following calendar month and advance automatically. Bookings, cancellations, favorites, and profile edits are simulated in memory and reset after refresh. Image fields are blank placeholders.

Enable the demo with `NEXT_PUBLIC_DEMO_MODE=true`, visit `/login?demo=true`, or select **Try demo account** from the login page. Set the Vercel project root to `Web/reza-client`; demo mode needs no backend environment variables.

| Account | Email | Password | Demo focus |
| --- | --- | --- | --- |
| Customer | `demo.client@reza.ma` | `demo1234` | Discover salons, view services/reviews, book, cancel, manage favorites |

```text
Customer pages -> lib/api.ts -> live Express API (normal mode)
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
