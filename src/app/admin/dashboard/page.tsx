"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Settings,
  ShoppingCart,
  BarChart3,
  Tag,
  Search,
  Trash2,
  Save,
  Plus,
  X,
  Eye,
  ExternalLink,
} from "lucide-react";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";

type Order = {
  id: string;
  created_at: string;
  status: string;
  order_status: string;
  email: string;
  message: string;
  gift_note: string | null;
  music_option: string;
  music_link: string | null;
  music_file_url: string | null;
  delivery_method: string;
  photo_url: string;
  total_usd: number;
  notes: string | null;
  cost: number;
};

type PromoCode = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
};

type GoogleAdsExpense = {
  month: string;
  amount: number;
};

type Tab = "orders" | "analytics" | "settings" | "promo";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [isLoading, setIsLoading] = useState(true);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editingCost, setEditingCost] = useState<Record<string, string>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Promo state
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [newPromo, setNewPromo] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: 0,
    maxUses: "",
    expiresAt: "",
  });

  // Settings state
  const [stripeSettings, setStripeSettings] = useState({
    secretKey: "",
    publishableKey: "",
  });

  // Google Ads state
  const [googleAdsExpenses, setGoogleAdsExpenses] = useState<GoogleAdsExpense[]>([]);
  const [newAdsMonth, setNewAdsMonth] = useState("");
  const [newAdsAmount, setNewAdsAmount] = useState("");

  const authHeaders = useCallback(() => {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [token]);

  // Check auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("adminToken");
    if (!storedToken) {
      router.push("/admin");
      return;
    }
    setToken(storedToken);
    setIsLoading(false);
  }, [router]);

  // Fetch data based on active tab
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Fetch orders error:", error);
    }
  }, [token]);

  const fetchPromoCodes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/promo-codes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPromoCodes(data.promoCodes || []);
      }
    } catch (error) {
      console.error("Fetch promo codes error:", error);
    }
  }, [token]);

  const fetchPromoSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/promo-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPromoEnabled(data.enabled);
      }
    } catch (error) {
      console.error("Fetch promo settings error:", error);
    }
  }, [token]);

  const fetchStripeSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/stripe-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStripeSettings({
          secretKey: data.secretKey || "",
          publishableKey: data.publishableKey || "",
        });
      }
    } catch (error) {
      console.error("Fetch stripe settings error:", error);
    }
  }, [token]);

  const fetchGoogleAdsExpenses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/google-ads-expenses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleAdsExpenses(data.expenses || []);
      }
    } catch (error) {
      console.error("Fetch google ads error:", error);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === "orders") {
      fetchOrders();
    } else if (activeTab === "analytics") {
      fetchOrders();
      fetchGoogleAdsExpenses();
    } else if (activeTab === "settings") {
      fetchStripeSettings();
    } else if (activeTab === "promo") {
      fetchPromoCodes();
      fetchPromoSettings();
    }
  }, [
    token,
    activeTab,
    fetchOrders,
    fetchPromoCodes,
    fetchPromoSettings,
    fetchStripeSettings,
    fetchGoogleAdsExpenses,
  ]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    router.push("/admin");
  };

  // Order actions
  const updateOrderStatus = async (orderId: string, orderStatus: string) => {
    await fetch("/api/admin/orders/update", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ orderId, orderStatus }),
    });
    fetchOrders();
  };

  const saveOrderNotes = async (orderId: string) => {
    const notes = editingNotes[orderId];
    await fetch("/api/admin/orders/update", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ orderId, notes }),
    });
    setEditingNotes((prev) => {
      const copy = { ...prev };
      delete copy[orderId];
      return copy;
    });
    fetchOrders();
  };

  const saveOrderCost = async (orderId: string) => {
    const cost = parseFloat(editingCost[orderId] || "0");
    await fetch("/api/admin/orders/update", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ orderId, cost }),
    });
    setEditingCost((prev) => {
      const copy = { ...prev };
      delete copy[orderId];
      return copy;
    });
    fetchOrders();
  };

  const deleteOrderHandler = async (orderId: string) => {
    if (!confirm("Delete this order?")) return;
    await fetch(`/api/admin/orders/delete?id=${orderId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    fetchOrders();
  };

  // Promo actions
  const togglePromoEnabled = async () => {
    await fetch("/api/admin/promo-settings", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ enabled: !promoEnabled }),
    });
    setPromoEnabled(!promoEnabled);
  };

  const createPromoHandler = async () => {
    await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        code: newPromo.code,
        discountType: newPromo.discountType,
        discountValue: newPromo.discountValue,
        maxUses: newPromo.maxUses ? parseInt(newPromo.maxUses) : undefined,
        expiresAt: newPromo.expiresAt || undefined,
      }),
    });
    setShowPromoForm(false);
    setNewPromo({
      code: "",
      discountType: "percentage",
      discountValue: 0,
      maxUses: "",
      expiresAt: "",
    });
    fetchPromoCodes();
  };

  const togglePromoActive = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/promo-codes", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchPromoCodes();
  };

  const deletePromoHandler = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    await fetch(`/api/admin/promo-codes?id=${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    fetchPromoCodes();
  };

  // Settings actions
  const saveStripeSettings = async () => {
    await fetch("/api/admin/stripe-settings", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(stripeSettings),
    });
    alert("Stripe settings saved");
  };

  // Google Ads actions
  const saveGoogleAdsExpense = async () => {
    if (!newAdsMonth || !newAdsAmount) return;
    await fetch("/api/admin/google-ads-expenses", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        month: newAdsMonth,
        amount: parseFloat(newAdsAmount),
      }),
    });
    setNewAdsMonth("");
    setNewAdsAmount("");
    fetchGoogleAdsExpenses();
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !order.email.toLowerCase().includes(q) &&
        !order.id.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (statusFilter !== "all" && order.order_status !== statusFilter) {
      return false;
    }
    if (dateFilter !== "all") {
      const orderDate = new Date(order.created_at);
      const now = new Date();
      if (dateFilter === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (orderDate < today) return false;
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (orderDate < weekAgo) return false;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (orderDate < monthAgo) return false;
      }
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "orders", label: "Orders", icon: <ShoppingCart className="w-5 h-5" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-5 h-5" /> },
    { id: "promo", label: "Promo Codes", icon: <Tag className="w-5 h-5" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Header */}
      <header className="glass-card border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">AfroBirthday Admin</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-orange-500 to-purple-600 text-white"
                  : "glass-card text-white/70 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="glass-card p-4 rounded-xl flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Search by email or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>

            {/* Orders Table */}
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 text-white/60 font-medium">ID</th>
                      <th className="text-left p-4 text-white/60 font-medium">Email</th>
                      <th className="text-left p-4 text-white/60 font-medium">Price</th>
                      <th className="text-left p-4 text-white/60 font-medium">Cost</th>
                      <th className="text-left p-4 text-white/60 font-medium">Status</th>
                      <th className="text-left p-4 text-white/60 font-medium">Date</th>
                      <th className="text-left p-4 text-white/60 font-medium">Notes</th>
                      <th className="text-left p-4 text-white/60 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4 text-white/80 font-mono text-sm">
                          {order.id.slice(0, 8)}...
                        </td>
                        <td className="p-4 text-white">{order.email}</td>
                        <td className="p-4 text-green-400 font-medium">
                          ${Number(order.total_usd).toFixed(2)}
                        </td>
                        <td className="p-4">
                          {editingCost[order.id] !== undefined ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editingCost[order.id]}
                                onChange={(e) =>
                                  setEditingCost((prev) => ({
                                    ...prev,
                                    [order.id]: e.target.value,
                                  }))
                                }
                                className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                              />
                              <button
                                onClick={() => saveOrderCost(order.id)}
                                className="p-1 text-green-400 hover:text-green-300"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setEditingCost((prev) => ({
                                  ...prev,
                                  [order.id]: String(order.cost || 0),
                                }))
                              }
                              className="text-white/60 hover:text-white"
                            >
                              ${Number(order.cost || 0).toFixed(2)}
                            </button>
                          )}
                        </td>
                        <td className="p-4">
                          <select
                            value={order.order_status || "pending"}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              order.order_status === "completed"
                                ? "bg-green-500/20 text-green-400"
                                : order.order_status === "processing"
                                ? "bg-blue-500/20 text-blue-400"
                                : order.order_status === "cancelled"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="p-4 text-white/60 text-sm">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          {editingNotes[order.id] !== undefined ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingNotes[order.id]}
                                onChange={(e) =>
                                  setEditingNotes((prev) => ({
                                    ...prev,
                                    [order.id]: e.target.value,
                                  }))
                                }
                                className="w-32 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
                              />
                              <button
                                onClick={() => saveOrderNotes(order.id)}
                                className="p-1 text-green-400 hover:text-green-300"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setEditingNotes((prev) => ({
                                  ...prev,
                                  [order.id]: order.notes || "",
                                }))
                              }
                              className="text-white/60 hover:text-white text-sm"
                            >
                              {order.notes || "Add note"}
                            </button>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteOrderHandler(order.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredOrders.length === 0 && (
                <div className="p-8 text-center text-white/60">No orders found</div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Google Ads Input */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">
                Google Ads Expenses
              </h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Month</label>
                  <input
                    type="month"
                    value={newAdsMonth}
                    onChange={(e) => setNewAdsMonth(e.target.value)}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    value={newAdsAmount}
                    onChange={(e) => setNewAdsAmount(e.target.value)}
                    placeholder="0.00"
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <button
                  onClick={saveGoogleAdsExpense}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Save
                </button>
              </div>
              {googleAdsExpenses.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {googleAdsExpenses.map((exp) => (
                    <div
                      key={exp.month}
                      className="p-2 bg-white/5 rounded-lg text-sm"
                    >
                      <span className="text-white/60">{exp.month}:</span>{" "}
                      <span className="text-white font-medium">
                        ${Number(exp.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <AnalyticsDashboard
              orders={orders}
              googleAdsExpenses={googleAdsExpenses}
            />
          </div>
        )}

        {/* Promo Tab */}
        {activeTab === "promo" && (
          <div className="space-y-6">
            {/* Promo Toggle */}
            <div className="glass-card p-6 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Promo Code Field
                </h3>
                <p className="text-white/60 text-sm">
                  Show promo code input on checkout
                </p>
              </div>
              <button
                onClick={togglePromoEnabled}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  promoEnabled ? "bg-green-500" : "bg-white/20"
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    promoEnabled ? "left-8" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Add Promo Button */}
            <button
              onClick={() => setShowPromoForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-purple-600 text-white rounded-lg hover:from-orange-600 hover:to-purple-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              New Promo Code
            </button>

            {/* Promo Form Modal */}
            {showPromoForm && (
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    New Promo Code
                  </h3>
                  <button
                    onClick={() => setShowPromoForm(false)}
                    className="text-white/60 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">
                      Code
                    </label>
                    <input
                      type="text"
                      value={newPromo.code}
                      onChange={(e) =>
                        setNewPromo((p) => ({ ...p, code: e.target.value }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">
                      Type
                    </label>
                    <select
                      value={newPromo.discountType}
                      onChange={(e) =>
                        setNewPromo((p) => ({
                          ...p,
                          discountType: e.target.value as "percentage" | "fixed",
                        }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      value={newPromo.discountValue}
                      onChange={(e) =>
                        setNewPromo((p) => ({
                          ...p,
                          discountValue: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">
                      Max Uses (optional)
                    </label>
                    <input
                      type="number"
                      value={newPromo.maxUses}
                      onChange={(e) =>
                        setNewPromo((p) => ({ ...p, maxUses: e.target.value }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">
                      Expires At (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={newPromo.expiresAt}
                      onChange={(e) =>
                        setNewPromo((p) => ({ ...p, expiresAt: e.target.value }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                </div>
                <button
                  onClick={createPromoHandler}
                  className="mt-4 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Create
                </button>
              </div>
            )}

            {/* Promo List */}
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-white/60 font-medium">Code</th>
                    <th className="text-left p-4 text-white/60 font-medium">Discount</th>
                    <th className="text-left p-4 text-white/60 font-medium">Uses</th>
                    <th className="text-left p-4 text-white/60 font-medium">Expires</th>
                    <th className="text-left p-4 text-white/60 font-medium">Active</th>
                    <th className="text-left p-4 text-white/60 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((promo) => (
                    <tr
                      key={promo.id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="p-4 text-white font-mono">{promo.code}</td>
                      <td className="p-4 text-white">
                        {promo.discount_type === "percentage"
                          ? `${promo.discount_value}%`
                          : `$${promo.discount_value}`}
                      </td>
                      <td className="p-4 text-white/60">
                        {promo.current_uses}
                        {promo.max_uses ? ` / ${promo.max_uses}` : ""}
                      </td>
                      <td className="p-4 text-white/60 text-sm">
                        {promo.expires_at
                          ? new Date(promo.expires_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => togglePromoActive(promo.id, promo.is_active)}
                          className={`px-2 py-1 rounded text-sm font-medium ${
                            promo.is_active
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {promo.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => deletePromoHandler(promo.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {promoCodes.length === 0 && (
                <div className="p-8 text-center text-white/60">
                  No promo codes yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">
                Stripe API Keys
              </h3>
              <p className="text-white/60 text-sm mb-4">
                These keys are stored in the database. For production, use
                environment variables instead.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">
                    Secret Key (sk_...)
                  </label>
                  <input
                    type="password"
                    value={stripeSettings.secretKey}
                    onChange={(e) =>
                      setStripeSettings((s) => ({
                        ...s,
                        secretKey: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">
                    Publishable Key (pk_...)
                  </label>
                  <input
                    type="text"
                    value={stripeSettings.publishableKey}
                    onChange={(e) =>
                      setStripeSettings((s) => ({
                        ...s,
                        publishableKey: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <button
                  onClick={saveStripeSettings}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Save Stripe Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-sm">Order ID</p>
                  <p className="text-white font-mono text-sm">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Date</p>
                  <p className="text-white">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Email</p>
                  <p className="text-white">{selectedOrder.email}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Total</p>
                  <p className="text-green-400 font-bold">
                    ${Number(selectedOrder.total_usd).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Payment Status</p>
                  <p
                    className={
                      selectedOrder.status === "paid"
                        ? "text-green-400"
                        : "text-yellow-400"
                    }
                  >
                    {selectedOrder.status}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Order Status</p>
                  <p className="text-white">{selectedOrder.order_status}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Delivery</p>
                  <p className="text-white">{selectedOrder.delivery_method}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Music</p>
                  <p className="text-white">{selectedOrder.music_option}</p>
                </div>
              </div>
              <div>
                <p className="text-white/60 text-sm">Message</p>
                <p className="text-white bg-white/5 p-3 rounded-lg mt-1">
                  {selectedOrder.message}
                </p>
              </div>
              {selectedOrder.gift_note && (
                <div>
                  <p className="text-white/60 text-sm">Gift Note</p>
                  <p className="text-white bg-white/5 p-3 rounded-lg mt-1">
                    {selectedOrder.gift_note}
                  </p>
                </div>
              )}
              <div>
                <p className="text-white/60 text-sm">Photo</p>
                <a
                  href={selectedOrder.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 mt-1"
                >
                  View Photo <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              {selectedOrder.music_link && (
                <div>
                  <p className="text-white/60 text-sm">Music Link</p>
                  <a
                    href={selectedOrder.music_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 mt-1"
                  >
                    Open Link <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
              {selectedOrder.music_file_url && (
                <div>
                  <p className="text-white/60 text-sm">Music File</p>
                  <a
                    href={selectedOrder.music_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 mt-1"
                  >
                    Download File <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
