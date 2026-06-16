This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

Open [http://localhost:3030](http://localhost:3030) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Background Tasks & Odds Management

This project includes a market probabilities and Head-to-Head (H2H) stats module with background automation:

### Running TS Scripts
To run the background scripts locally or on Raspberry Pi 5:

1. **Refresh Global Odds for Upcoming Matches** (runs within the next hour kickoff window):
   ```bash
   npm run odds:refresh-upcoming
   ```

2. **Populate Missing Head-to-Head Statistics**:
   ```bash
   npm run h2h:fetch-missing
   ```

See the [Odds and H2H Module Documentation](../docs/ODDS.md) for more details.

