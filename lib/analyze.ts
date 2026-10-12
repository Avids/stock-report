/* Turns raw Yahoo Finance data into scored report sections.
   Scores are 1-5 heuristics, not investment advice. */

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const pct = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : n * 100;
};

const LABELS = {
  business: ['Poor', 'Weak', 'Fair', 'Good', 'Excellent'],
  growth: ['Declining', 'Slow', 'Average', 'Strong', 'Hyper'],
  management: ['Weak', 'Weak', 'Average', 'Good', 'Great'],
  risk: ['High', 'High', 'Moderate', 'Low', 'Low'],
  valuation: ['Expensive', 'Stretched', 'Fair', 'Attractive', 'Cheap'],
};

export function buildReport(q: any) {
  const p = q.price ?? {};
  const f = q.financialData ?? {};
  const k = q.defaultKeyStatistics ?? {};
  const s = q.summaryDetail ?? {};
  const prof = q.summaryProfile ?? {};

  const price = num(p.regularMarketPrice) ?? 0;
  const mcap = num(p.marketCap);
  const revG = pct(f.revenueGrowth);
  const earnG = pct(f.earningsGrowth);
  const gm = pct(f.grossMargins);
  const om = pct(f.operatingMargins);
  const nm = pct(f.profitMargins);
  const roe = pct(f.returnOnEquity);
  const fcf = num(f.freeCashflow);
  const dte = num(f.debtToEquity);
  const cr = num(f.currentRatio);
  const beta = num(k.beta);
  const eps = num(k.trailingEps);
  const insiders = pct(k.heldPercentInsiders);
  const pe = num(s.trailingPE) ?? (eps && price ? price / eps : null);
  const ps = num(s.priceToSalesTrailing12Months);
  const pb = num(k.priceToBook);
  const pfcf = mcap && fcf && fcf > 0 ? mcap / fcf : null;

  const g = gm ?? 0, o = om ?? 0, r = roe ?? 0, n = nm ?? 0, fc = fcf ?? 0;

  // Category scores (1-5)
  const growthScore =
    revG == null ? 3 : revG >= 20 ? 5 : revG >= 10 ? 4 : revG >= 5 ? 3 : revG >= 0 ? 2 : 1;

  const moatScore =
    g >= 50 && r >= 25 ? 5 : g >= 35 && r >= 15 ? 4 : g >= 20 && r >= 10 ? 3 : r > 0 ? 2 : 1;

  const businessScore =
    o >= 20 && fc > 0 ? 5 : o >= 10 && fc > 0 ? 4 : fc > 0 ? 3 : o > 0 ? 2 : 1;

  let mg = 3;
  if (r >= 15) mg++;
  if (n < 0) mg--;
  if ((insiders ?? 0) >= 5) mg++;
  const managementScore = clamp(mg, 1, 5);

  let rk = 3;
  if (dte != null) rk += dte < 50 ? 1 : dte > 150 ? -1 : 0;
  if (cr != null) rk += cr >= 1.5 ? 1 : cr < 1 ? -1 : 0;
  if (beta != null && beta > 1.5) rk--;
  const riskScore = clamp(rk, 1, 5);

  // Fair value: trailing EPS times a growth-based P/E, capped at 12x-30x
  const growthRate = earnG ?? revG ?? 8;
  const fairPE = clamp(growthRate, 12, 30);
  const fair = eps ? eps * fairPE : null;
  const cheap = fair ? fair * 0.85 : null;
  const expensive = fair ? fair * 1.15 : null;

  let valuationScore = 3;
  if (fair) {
    const ratio = price / fair;
    valuationScore = ratio < 0.85 ? 5 : ratio < 1 ? 4 : ratio < 1.15 ? 3 : ratio < 1.35 ? 2 : 1;
  }

  const cats = [
    { key: 'business', label: 'Business', score: businessScore, tag: LABELS.business[businessScore - 1] },
    {
      key: 'moat',
      label: 'Moat',
      score: moatScore,
      tag: moatScore >= 4 ? 'Wide' : moatScore === 3 ? 'Narrow' : 'None',
    },
    { key: 'growth', label: 'Growth', score: growthScore, tag: LABELS.growth[growthScore - 1] },
    {
      key: 'management',
      label: 'Management',
      score: managementScore,
      tag: LABELS.management[managementScore - 1],
    },
    { key: 'risk', label: 'Risk', score: riskScore, tag: LABELS.risk[riskScore - 1] },
    {
      key: 'valuation',
      label: 'Valuation',
      score: valuationScore,
      tag: LABELS.valuation[valuationScore - 1],
    },
  ];

  const composite = Math.round((cats.reduce((a, c) => a + c.score, 0) / cats.length) * 10) / 10;
  const rating = composite >= 4 ? 'Strong' : composite >= 3 ? 'Watch' : 'Caution';

  // Lifecycle phase
  let phase: string;
  if (revG == null) phase = 'Unknown';
  else if (revG < 0) phase = '5 · Decline';
  else if (o < 0 && revG > 20) phase = '1 · Startup';
  else if (fc < 0 && revG > 20) phase = '2 · Hyper growth';
  else if (fc > 0 && o >= 15 && revG < 15) phase = '4 · Capital return';
  else phase = '3 · Operating leverage';

  const green: string[] = [];
  const red: string[] = [];
  if (revG != null && revG >= 10) green.push('Revenue growth stays strong');
  if (r >= 15) green.push('Returns on equity are high');
  if (fc > 0) green.push('Free cash flow is positive');
  if (revG != null && revG < 5) red.push('Revenue growth is slowing');
  if (pe != null && pe > 40) red.push('Valuation runs ahead of earnings');
  if (dte != null && dte > 150) red.push('Leverage is elevated');
  if (n < 0) red.push('The company is unprofitable');

  return {
    ticker: p.symbol ?? '',
    name: p.longName ?? p.shortName ?? '',
    exchange: p.exchangeName ?? '',
    currency: p.currency ?? 'USD',
    sector: prof.sector ?? '',
    industry: prof.industry ?? '',
    employees: num(prof.fullTimeEmployees),
    description: prof.longBusinessSummary ?? '',
    price,
    marketCap: mcap,
    asOf: new Date().toISOString(),
    composite: { score: composite, rating },
    categories: cats,
    phase,
    growth: { revG, earnG },
    margins: { gm, om, nm, roe },
    balance: { cash: num(f.totalCash), debt: num(f.totalDebt), fcf, dte, cr, beta },
    insiders,
    valuation: { pe, ps, pb, pfcf, cheap, fair, expensive },
    flags: { green, red },
  };
}

export type Report = ReturnType<typeof buildReport>;
