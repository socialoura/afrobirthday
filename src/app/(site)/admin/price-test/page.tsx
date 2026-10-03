"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { CellMetrics, PriceTestReport } from "@/lib/priceTestReport";

const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
const usd = (x: number) => `$${x.toFixed(2)}`;
const range = ([a, b]: [number, number], f: (x: number) => string) => `${f(a)} – ${f(b)}`;

const VERDICT_STYLE: Record<PriceTestReport["verdict"]["status"], string> = {
  no_test: "bg-gray-100 text-gray-700 border-gray-300",
  not_enough_data: "bg-amber-50 text-amber-900 border-amber-300",
  inconclusive: "bg-slate-50 text-slate-800 border-slate-300",
  winning: "bg-green-50 text-green-900 border-green-300",
  losing: "bg-red-50 text-red-900 border-red-300",
};

const ROWS: Array<[string, (c: CellMetrics) => string]> = [
  ["Visiteurs", (c) => (c.visitors == null ? "–" : String(c.visitors))],
  ["Clients arrivés au paiement", (c) => String(c.customers)],
  ["Payants", (c) => String(c.payers)],
  ["Conversion", (c) => pct(c.conversion)],
  ["  intervalle 95 %", (c) => range(c.conversionCi, (x) => `${(100 * x).toFixed(0)} %`)],
  ["CA par client", (c) => usd(c.revenuePerCustomer)],
  ["  intervalle 95 %", (c) => range(c.revenuePerCustomerCi, (x) => `$${x.toFixed(1)}`)],
  ["CA par visiteur", (c) => (c.revenuePerVisitor == null ? "–" : usd(c.revenuePerVisitor))],
  ["Panier moyen", (c) => usd(c.averageOrderUsd)],
  ["Avec au moins une option", (c) => pct(c.optionRate)],
  ["CA total", (c) => usd(c.revenueUsd)],
];

export default function PriceTestPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [report, setReport] = useState<PriceTestReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("adminToken");
    if (!stored) {
      router.push("/admin");
      return;
    }
    setToken(stored);
  }, [router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/price-test", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        router.push("/admin");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    load();
  }, [load]);

  const cells = report?.cells;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Tableau de bord
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test de prix</h1>
          {report?.test && (
            <p className="mt-1 text-sm text-gray-600">
              {report.test.description} · démarré le{" "}
              {new Date(report.test.startedAt).toLocaleString("fr-FR")}
              {report.test.endedAt && <> · terminé le {new Date(report.test.endedAt).toLocaleString("fr-FR")}</>}
              {" "}· témoin : {report.test.controlCurrencies.join(", ")} (prix inchangé)
            </p>
          )}
        </div>

        {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        {report && (
          <div className={`rounded-lg border p-4 text-sm ${VERDICT_STYLE[report.verdict.status]}`}>
            <strong>Verdict :</strong> {report.verdict.message}
          </div>
        )}

        {report?.diffInDiff && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Effet sur le CA par client</div>
              <div className="mt-1 text-2xl font-semibold">
                {report.diffInDiff.revenuePerCustomer.estimate >= 0 ? "+" : ""}
                {usd(report.diffInDiff.revenuePerCustomer.estimate)}
              </div>
              <div className="text-xs text-gray-500">
                intervalle 95 % : {range(report.diffInDiff.revenuePerCustomer.ci, usd)}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Effet sur la conversion</div>
              <div className="mt-1 text-2xl font-semibold">
                {report.diffInDiff.conversion.estimate >= 0 ? "+" : ""}
                {(100 * report.diffInDiff.conversion.estimate).toFixed(1)} pts
              </div>
              <div className="text-xs text-gray-500">
                intervalle 95 % : {range(report.diffInDiff.conversion.ci, (x) => `${(100 * x).toFixed(1)}`)} pts
              </div>
            </div>
          </div>
        )}

        {cells && report?.windows && (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2">Test · avant</th>
                  <th className="px-3 py-2">Test · après</th>
                  <th className="px-3 py-2">Témoin · avant</th>
                  <th className="px-3 py-2">Témoin · après</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, f], i) => (
                  <tr key={i} className="border-t">
                    <td className={`whitespace-pre px-3 py-2 ${label.startsWith("  ") ? "text-xs text-gray-500" : "font-medium"}`}>
                      {label}
                    </td>
                    {[cells.test.before, cells.test.after, cells.control.before, cells.control.after].map((c, j) => (
                      <td key={j} className={`px-3 py-2 ${label.startsWith("  ") ? "text-xs text-gray-500" : ""}`}>
                        {f(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {report?.notes && report.notes.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-gray-500">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {report.windows && (
              <li>
                Avant : {new Date(report.windows.before.from).toLocaleDateString("fr-FR")} →{" "}
                {new Date(report.windows.before.to).toLocaleDateString("fr-FR")} · Après :{" "}
                {new Date(report.windows.after.from).toLocaleDateString("fr-FR")} →{" "}
                {new Date(report.windows.after.to).toLocaleDateString("fr-FR")}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
