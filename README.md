# Stock report

Enter a ticker, get a one-page scored analysis. Next.js + yahoo-finance2 (no API key).

## Run locally
    npm install
    npm run dev
Open http://localhost:3000 and try CMG.

## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. In Vercel, click Add New > Project, import the repo. Framework: Next.js (auto-detected).
3. Click Deploy. No environment variables needed.

## Notes
- yahoo-finance2 uses Yahoo's unofficial endpoints. Fine for personal use; heavy traffic can get rate-limited.
- Scoring logic lives in lib/analyze.ts. Tune thresholds there.
