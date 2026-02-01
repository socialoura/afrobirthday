"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, DollarSign, ShoppingCart, Percent } from "lucide-react";

type Order = {
  id: string;
  created_at: string;
  total_usd: number;
  cost: number;
  status: string;
  order_status: string;
  delivery_method: string;
  music_option: string;
};

type GoogleAdsExpense = {
  month: string;
  amount: number;
};

type Props = {
  orders: Order[];
  totalVisitors?: number;
  googleAdsExpenses?: GoogleAdsExpense[];
};

const COLORS = ["#f97316", "#8b5cf6", "#10b981", "#3b82f6", "#ec4899"];

export default function AnalyticsDashboard({
  orders,
  totalVisitors = 1000,
  googleAdsExpenses = [],
}: Props) {
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const paidOrders = orders.filter((o) => o.status === "paid");

    const todayRevenue = paidOrders
      .filter((o) => new Date(o.created_at) >= today)
      .reduce((sum, o) => sum + Number(o.total_usd), 0);

    const weekRevenue = paidOrders
      .filter((o) => new Date(o.created_at) >= weekAgo)
      .reduce((sum, o) => sum + Number(o.total_usd), 0);

    const monthRevenue = paidOrders
      .filter((o) => new Date(o.created_at) >= monthAgo)
      .reduce((sum, o) => sum + Number(o.total_usd), 0);

    const totalRevenue = paidOrders.reduce(
      (sum, o) => sum + Number(o.total_usd),
      0
    );

    const totalProfit = paidOrders.reduce(
      (sum, o) => sum + Number(o.total_usd) - Number(o.cost || 0),
      0
    );

    const avgCart =
      paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
    const conversionRate =
      totalVisitors > 0 ? (paidOrders.length / totalVisitors) * 100 : 0;

    return {
      todayRevenue,
      weekRevenue,
      monthRevenue,
      totalRevenue,
      totalProfit,
      totalOrders: paidOrders.length,
      avgCart,
      conversionRate,
    };
  }, [orders, totalVisitors]);

  const last7DaysData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dayOrders = orders.filter(
        (o) =>
          o.status === "paid" && o.created_at.split("T")[0] === dateStr
      );
      const revenue = dayOrders.reduce(
        (sum, o) => sum + Number(o.total_usd),
        0
      );
      data.push({
        date: date.toLocaleDateString("en-US", { weekday: "short" }),
        revenue,
      });
    }
    return data;
  }, [orders]);

  const last30DaysData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dayOrders = orders.filter(
        (o) =>
          o.status === "paid" && o.created_at.split("T")[0] === dateStr
      );
      const revenue = dayOrders.reduce(
        (sum, o) => sum + Number(o.total_usd),
        0
      );
      const profit = dayOrders.reduce(
        (sum, o) => sum + Number(o.total_usd) - Number(o.cost || 0),
        0
      );
      data.push({
        date: date.getDate().toString(),
        revenue,
        profit,
      });
    }
    return data;
  }, [orders]);

  const monthlyNetProfitData = useMemo(() => {
    const monthlyData: Record<string, { revenue: number; cost: number }> = {};

    orders
      .filter((o) => o.status === "paid")
      .forEach((order) => {
        const month = order.created_at.slice(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = { revenue: 0, cost: 0 };
        }
        monthlyData[month].revenue += Number(order.total_usd);
        monthlyData[month].cost += Number(order.cost || 0);
      });

    const adsMap = new Map(googleAdsExpenses.map((e) => [e.month, Number(e.amount)]));

    const months = Object.keys(monthlyData).sort().slice(-12);
    return months.map((month) => {
      const d = monthlyData[month];
      const adsSpend = adsMap.get(month) || 0;
      const netProfit = d.revenue - d.cost - adsSpend;
      return {
        month: month.slice(5),
        netProfit,
        adsSpend,
      };
    });
  }, [orders, googleAdsExpenses]);

  const deliveryDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    orders
      .filter((o) => o.status === "paid")
      .forEach((o) => {
        const key = o.delivery_method || "standard";
        dist[key] = (dist[key] || 0) + 1;
      });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Revenue Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl">
          <p className="text-white/60 text-sm">Today</p>
          <p className="text-2xl font-bold text-white">
            ${stats.todayRevenue.toFixed(2)}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-white/60 text-sm">7 Days</p>
          <p className="text-2xl font-bold text-white">
            ${stats.weekRevenue.toFixed(2)}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-white/60 text-sm">30 Days</p>
          <p className="text-2xl font-bold text-white">
            ${stats.monthRevenue.toFixed(2)}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-white/60 text-sm">All Time</p>
          <p className="text-2xl font-bold text-white">
            ${stats.totalRevenue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl flex items-center gap-3">
          <div className="p-3 rounded-lg bg-orange-500/20">
            <DollarSign className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <p className="text-white/60 text-sm">Total Revenue</p>
            <p className="text-xl font-bold text-white">
              ${stats.totalRevenue.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-500/20">
            <ShoppingCart className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-white/60 text-sm">Total Orders</p>
            <p className="text-xl font-bold text-white">{stats.totalOrders}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl flex items-center gap-3">
          <div className="p-3 rounded-lg bg-green-500/20">
            <TrendingUp className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-white/60 text-sm">Avg Cart</p>
            <p className="text-xl font-bold text-white">
              ${stats.avgCart.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-500/20">
            <Percent className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-white/60 text-sm">Conversion</p>
            <p className="text-xl font-bold text-white">
              {stats.conversionRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">
            Revenue (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={last7DaysData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="date" stroke="#ffffff60" />
              <YAxis stroke="#ffffff60" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">
            Revenue (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={last30DaysData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="date" stroke="#ffffff60" />
              <YAxis stroke="#ffffff60" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">
            Profit (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={last30DaysData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="date" stroke="#ffffff60" />
              <YAxis stroke="#ffffff60" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">
            Net Profit by Month (incl. Google Ads)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyNetProfitData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="month" stroke="#ffffff60" />
              <YAxis stroke="#ffffff60" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar
                dataKey="netProfit"
                name="Net Profit"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="adsSpend"
                name="Ads Spend"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Delivery Distribution */}
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-white mb-4">
          Delivery Method Distribution
        </h3>
        <div className="flex justify-center">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={deliveryDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {deliveryDistribution.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
