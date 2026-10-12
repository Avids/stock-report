'use client';

import { useState, type FormEvent } from 'react';
import type { Report } from '@/lib/analyze';

const dec = (n: number | null | undefined, d = 1, suffix = '') =>
  n == null ? '—' : `${n.toFixed(d)}${suffix}`;

const big = (n: number | null) =>
  n == null
    ? '—'
    : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T`
    : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B`
    : `$${(n / 1e6).toFixed(0)}M`;

const tone = (n: number | null, good: number, bad: number) =>
  n == null ? '' : n >= good ? 'pos' : n <= bad ? 'neg' : 'amber';

export default function Home() {
  const [input, setInput] = useState('CMG');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/report/${encodeURIComponent(input.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <form onSubmit={run} className="search">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ticker, e.g. CMG"
          aria-label="Ticker symbol"
        />
        <button disabled={loading}>{loading ? 'Loading…' : 'Generate report'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {report && <ReportView r={report} />}
    </main>
  );
}

function ReportView({ r }: { r: Report }) {
  const v = r.valuation;
  const phaseIndex = parseInt(r.phase, 10);
  const phases = ['Startup', 'Hyper growth', 'Operating leverage', 'Capital return', 'Decline'];

  let marker: number | null = null;
  if (v.cheap && v.expensive) {
    const lo = v.cheap * 0.8, hi = v.expensive * 1.2;
    marker = Math.min(100, Math.max(0, ((r.price - lo) / (hi - lo)) * 100));
  }

  return (
    <article>
      <header className="masthead">
        <div>
          <h1>
            {r.name} <span className="meta">{r.ticker} · {r.exchange}</span>
          </h1>
          <div className="meta">
            {[r.sector, r.industry, r.employees ? `${r.employees.toLocaleString()} employees` : null]
              .filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="price">
          {r.currency} {dec(r.price, 2)}
          <small>Market cap {big(r.marketCap)} · as of {new Date(r.asOf).toLocaleDateString()}</small>
        </div>
      </header>

      <section className="summary">
        <div className="composite">
          <strong>{dec(r.composite.score, 1)}</strong>
          <span className="label">Composite</span>
          <span className="tag">{r.composite.rating}</span>
        </div>
        {r.categories.map((c) => (
          <div key={c.key}>
            <div className="label">{c.label}</div>
            <div className="tag">{c.tag}</div>
            <div className="dots">
              {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= c.score ? 'on' : ''} />)}
            </div>
          </div>
        ))}
      </section>

      <div className="grid">
        <section className="card">
          <h2>Business <span>{r.description ? 'Profile' : ''}</span></h2>
          <p className="note" style={{ marginTop: 0 }}>
            {r.description ? r.description.slice(0, 260) + (r.description.length > 260 ? '…' : '') : 'No description available.'}
          </p>
          <div className="row"><span>Gross margin</span><b>{dec(r.margins.gm, 1, '%')}</b></div>
          <div className="row"><span>Operating margin</span><b>{dec(r.margins.om, 1, '%')}</b></div>
          <div className="row"><span>Free cash flow</span><b className={tone(r.balance.fcf, 1, 0)}>{big(r.balance.fcf)}</b></div>
        </section>

        <section className="card">
          <h2>Phase <span>{r.phase}</span></h2>
          <div className="phase">
            {phases.map((p, i) => (
              <div key={p} className={i + 1 === phaseIndex ? 'on' : ''}>{p}</div>
            ))}
          </div>
          <p className="note">Phase is inferred from revenue growth, operating margin, and free cash flow.</p>
        </section>

        <section className="card">
          <h2>Growth <span>{r.categories[2].tag}</span></h2>
          <div className="row"><span>Revenue growth (latest year)</span><b className={tone(r.growth.revG, 10, 0)}>{dec(r.growth.revG, 1, '%')}</b></div>
          <div className="row"><span>Earnings growth (latest year)</span><b className={tone(r.growth.earnG, 10, 0)}>{dec(r.growth.earnG, 1, '%')}</b></div>
          <p className="note">Multi-year CAGRs need a historical financials source; this report uses the latest year.</p>
        </section>

        <section className="card">
          <h2>Management <span>{r.categories[3].tag}</span></h2>
          <div className="row"><span>Return on equity</span><b className={tone(r.margins.roe, 15, 0)}>{dec(r.margins.roe, 1, '%')}</b></div>
          <div className="row"><span>Net margin</span><b className={tone(r.margins.nm, 10, 0)}>{dec(r.margins.nm, 1, '%')}</b></div>
          <div className="row"><span>Insider ownership</span><b>{dec(r.insiders, 2, '%')}</b></div>
        </section>

        <section className="card">
          <h2>Risk <span>{r.categories[4].tag}</span></h2>
          <div className="row"><span>Debt to equity</span><b>{dec(r.balance.dte, 0, '%')}</b></div>
          <div className="row"><span>Current ratio</span><b>{dec(r.balance.cr, 2, '×')}</b></div>
          <div className="row"><span>Beta</span><b>{dec(r.balance.beta, 2)}</b></div>
          <div className="row"><span>Cash / debt</span><b>{big(r.balance.cash)} / {big(r.balance.debt)}</b></div>
        </section>

        <section className="card" style={{ gridColumn: 'span 2' }}>
          <h2>Valuation <span>{r.categories[5].tag}</span></h2>
          {marker !== null ? (
            <>
              <div className="band"><span /><span /><span /><div className="marker" style={{ left: `${marker}%` }} /></div>
              <div className="band-labels">
                <span className="pos">Cheap {dec(v.cheap, 2)}</span>
                <span className="amber">Fair {dec(v.fair, 2)}</span>
                <span className="neg">Expensive {dec(v.expensive, 2)}</span>
              </div>
            </>
          ) : (
            <p className="note">Fair value needs positive trailing earnings, so no range is shown.</p>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <span>P/E</span><b>{dec(v.pe, 1, '×')}</b>
          </div>
          <div className="row"><span>P/S</span><b>{dec(v.ps, 1, '×')}</b></div>
          <div className="row"><span>P/B</span><b>{dec(v.pb, 1, '×')}</b></div>
          <div className="row"><span>P/FCF</span><b>{dec(v.pfcf, 1, '×')}</b></div>
        </section>
      </div>

      <div className="flags">
        <section className="card">
          <h2 className="pos">Green flags</h2>
          {r.flags.green.length ? <ul>{r.flags.green.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="note">None triggered.</p>}
        </section>
        <section className="card">
          <h2 className="neg">Red flags</h2>
          {r.flags.red.length ? <ul>{r.flags.red.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="note">None triggered.</p>}
        </section>
      </div>

      <p className="note">
        Generated from Yahoo Finance data for information only. Scores are simple heuristics, not investment advice.
      </p>
    </article>
  );
}
