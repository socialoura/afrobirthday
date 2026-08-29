"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  Bot,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Info,
} from "lucide-react";

type Signals = {
  days: number;
  totals: { sessions: number; orders: number; conversionRate: number };
  daily: Array<{ date: string; sessions: number; orders: number }>;
  bySource: Array<{ source: string; sessions: number; orders: number }>;
  byLanding: Array<{ landing_path: string; sessions: number; orders: number }>;
};

const SOURCE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  copilot: "Copilot",
  gemini: "Gemini",
  claude: "Claude",
  you: "You.com",
  grok: "Grok",
};

export default function SeoSignalsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [days, setDays] = useState(60);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("adminToken");
    if (!stored) {
      router.push("/admin");
      return;
    }
    setToken(stored);
  }, [router]);

  const fetchSignals = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/seo/signals?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        router.push("/admin");
        return;
      }
      if (res.ok) setSignals(await res.json());
    } catch (err) {
      console.error("Fetch SEO signals error:", err);
    } finally {
      setLoading(false);
    }
  }, [token, days, router]);

  useEffect(() => {
    void fetchSignals();
  }, [fetchSignals]);

  const runIngest = async (backfillDays: number) => {
    if (!token) return;
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/seo/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ step: "ai-referrals", days: backfillDays }),
      });
      const data = await res.json();
      if (res.ok) {
        const r = data.result ?? {};
        setMessage(
          r.skipped
            ? `Skipped: ${r.skipped}`
            : `Ingested ${r.rows ?? 0} rows — ${r.sessions ?? 0} sessions, ${r.orders ?? 0} orders.`
        );
        await fetchSignals();
      } else {
        setMessage(`Failed: ${data.error ?? "unknown error"}`);
      }
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const totals = signals?.totals;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="p-2 rounded-lg glass-card hover:bg-white/10 transition"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-orange-400" />
                AI &amp; SEO signals
              </h1>
              <p className="text-white/60 text-sm">
                Sessions arriving from AI assistants, and what they buy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="glass-card rounded-lg px-3 py-2 text-white bg-transparent text-sm"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={120}>120 days</option>
              <option value={365}>1 year</option>
            </select>
            <button
              onClick={() => runIngest(7)}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium transition"
            >
              <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
              Refresh data
            </button>
            <button
              onClick={() => runIngest(365)}
              disabled={running}
              className="px-4 py-2 rounded-lg glass-card hover:bg-white/10 disabled:opacity-50 text-white text-sm transition"
              title="Re-ingest a full year from PostHog"
            >
              Backfill
            </button>
          </div>
        </div>

        {message && (
          <div className="glass-card rounded-xl p-3 text-sm text-white/80">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-4 rounded-xl flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-500/20">
              <Bot className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-white/60 text-sm">AI sessions</p>
              <p className="text-2xl font-bold text-white">
                {totals?.sessions ?? "—"}
              </p>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-500/20">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Orders from AI</p>
              <p className="text-2xl font-bold text-white">
                {totals?.orders ?? "—"}
              </p>
            </div>
          </div>
          <div className="glass-card p-4 rounded-xl flex items-center gap-3">
            <div className="p-3 rounded-lg bg-orange-500/20">
              <Sparkles className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-white/60 text-sm">Conversion rate</p>
              <p className="text-2xl font-bold text-white">
                {totals ? `${(totals.conversionRate * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <h2 className="text-white font-semibold mb-4">AI sessions per day</h2>
          {loading && !signals ? (
            <p className="text-white/50 text-sm py-12 text-center">Loading…</p>
          ) : signals && signals.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={signals.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,20,25,0.95)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 8,
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  name="Sessions"
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                  name="Orders"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/50 text-sm py-12 text-center">
              No data yet — hit “Backfill” to pull history from PostHog.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-white font-semibold mb-3">By assistant</h2>
            <SignalTable
              rows={(signals?.bySource ?? []).map((r) => ({
                label: SOURCE_LABELS[r.source] ?? r.source,
                sessions: r.sessions,
                orders: r.orders,
              }))}
              firstColumn="Assistant"
            />
          </div>

          <div className="glass-card rounded-xl p-4">
            <h2 className="text-white font-semibold mb-3">
              Landing pages AI sends people to
            </h2>
            <SignalTable
              rows={(signals?.byLanding ?? []).map((r) => ({
                label: r.landing_path,
                sessions: r.sessions,
                orders: r.orders,
              }))}
              firstColumn="Page"
            />
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-white/70 text-sm space-y-2">
            <p>
              These are real first-party sessions, counted from the entry
              utm_source PostHog records. They measure the{" "}
              <strong className="text-white">outcome</strong> of AI visibility —
              people who arrived and what they did.
            </p>
            <p>
              They do <strong className="text-white">not</strong> measure
              exposure. There is no API that reports how often an assistant
              mentions the site without a click, so share-of-voice and “AI rank”
              are not shown here because they cannot be known.
            </p>
            <p>
              Google Search Console&apos;s Generative AI report shows AI Overview
              and AI Mode impressions, but Google does not expose it through the
              API yet — read it in the Search Console UI for now.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalTable({
  rows,
  firstColumn,
}: {
  rows: Array<{ label: string; sessions: number; orders: number }>;
  firstColumn: string;
}) {
  if (rows.length === 0) {
    return <p className="text-white/50 text-sm py-6 text-center">No data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-white/50 text-left border-b border-white/10">
            <th className="py-2 font-medium">{firstColumn}</th>
            <th className="py-2 font-medium text-right">Sessions</th>
            <th className="py-2 font-medium text-right">Orders</th>
            <th className="py-2 font-medium text-right">CR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-white/5">
              <td className="py-2 text-white/90 break-all">{r.label}</td>
              <td className="py-2 text-white/70 text-right">{r.sessions}</td>
              <td className="py-2 text-white/70 text-right">{r.orders}</td>
              <td className="py-2 text-white/70 text-right">
                {r.sessions > 0
                  ? `${((r.orders / r.sessions) * 100).toFixed(1)}%`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
