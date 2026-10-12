import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { buildReport } from '@/lib/analyze';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const sym = ticker.trim().toUpperCase();

  if (!/^[A-Z0-9.\-^]{1,12}$/.test(sym)) {
    return Response.json({ error: 'Enter a valid ticker, e.g. CMG.' }, { status: 400 });
  }

  try {
    const q = await yahooFinance.quoteSummary(sym, {
      modules: ['price', 'summaryDetail', 'summaryProfile', 'financialData', 'defaultKeyStatistics'],
    });
    if (!q?.price?.regularMarketPrice) {
      return Response.json({ error: `No data found for ${sym}.` }, { status: 404 });
    }
    return Response.json(buildReport(q));
  } catch (e) {
    console.error('yahoo-finance2 failed for', sym, e);
    const message = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: `Data provider error: ${message.slice(0, 200)}` },
      { status: 502 },
    );
  }
}
