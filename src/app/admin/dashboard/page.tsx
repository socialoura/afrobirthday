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
  Upload,
  Send,
  Video,
  CheckCircle2,
} from "lucide-react";
import { uploadFileWithProgress } from "@/lib/clientUpload";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } from "@/lib/utils";

type OverrideForm = Record<
  string,
  { base: string; customSong: string; expressDelivery: string; danceExtended: string }
>;

type Order = {
  id: string;
  created_at: string;
  status: string;
  order_status: string;
  email: string;
  message: string;
  music_option: string;
  music_link: string | null;
  music_file_url: string | null;
  delivery_method: string;
  dance_extended: boolean;
  photo_url: string | null;
  total_usd: number;
  notes: string | null;
  cost: number;
  country: string | null;
  final_video_url: string | null;
  final_video_sent_at: string | null;
};

function countryCodeToFlag(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return code;
  const offset = 0x1f1e6;
  return String.fromCodePoint(
    upper.charCodeAt(0) - 65 + offset,
    upper.charCodeAt(1) - 65 + offset
  );
}

type PromoCode = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  owner_email: string | null;
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
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("paid");
  const [dateFilter, setDateFilter] = useState("all");
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editingCost, setEditingCost] = useState<Record<string, string>>({});
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [uploadingFinal, setUploadingFinal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sendingFinal, setSendingFinal] = useState(false);
  const [finalActionMessage, setFinalActionMessage] = useState<string | null>(null);

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
  const [pricingSettings, setPricingSettings] = useState({
    base: 19.99,
    customSong: 9.99,
    expressDelivery: 7.99,
    danceExtended: 20,
  });
  const [priceOverrides, setPriceOverrides] = useState<OverrideForm>({});
  const [newOverrideCurrency, setNewOverrideCurrency] = useState("");

  // Automated emails state (review request, abandoned cart, cross-sell,
  // annual reminder, referral) — one merged settings object.
  const [emailSettings, setEmailSettings] = useState<Record<string, string>>({});

  // Google Ads state
  const [googleAdsExpenses, setGoogleAdsExpenses] = useState<GoogleAdsExpense[]>([]);
  const [totalVisitors, setTotalVisitors] = useState<number | undefined>(undefined);
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

  const fetchEmailSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/automated-emails-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmailSettings(data.settings || {});
      }
    } catch (error) {
      console.error("Fetch automated email settings error:", error);
    }
  }, [token]);

  const fetchPricingSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/pricing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPricingSettings({
          base: typeof data.base === "number" ? data.base : 19.99,
          customSong: typeof data.customSong === "number" ? data.customSong : 9.99,
          expressDelivery: typeof data.expressDelivery === "number" ? data.expressDelivery : 7.99,
          danceExtended: typeof data.danceExtended === "number" ? data.danceExtended : 20,
        });

        const rawOverrides = (data.overrides ?? {}) as Record<
          string,
          Partial<{ base: number; customSong: number; expressDelivery: number; danceExtended: number }>
        >;
        const form: OverrideForm = {};
        for (const [code, value] of Object.entries(rawOverrides)) {
          form[code] = {
            base: value?.base != null ? String(value.base) : "",
            customSong: value?.customSong != null ? String(value.customSong) : "",
            expressDelivery: value?.expressDelivery != null ? String(value.expressDelivery) : "",
            danceExtended: value?.danceExtended != null ? String(value.danceExtended) : "",
          };
        }
        setPriceOverrides(form);
      }
    } catch (error) {
      console.error("Fetch pricing settings error:", error);
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

  const fetchTotalVisitors = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/analytics-visitors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.totalVisitors === "number") {
          setTotalVisitors(data.totalVisitors);
        }
      }
    } catch (error) {
      console.error("Fetch total visitors error:", error);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === "orders") {
      fetchOrders();
    } else if (activeTab === "analytics") {
      fetchOrders();
      fetchGoogleAdsExpenses();
      fetchTotalVisitors();
    } else if (activeTab === "settings") {
      fetchPricingSettings();
      fetchEmailSettings();
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
    fetchPricingSettings,
    fetchEmailSettings,
    fetchGoogleAdsExpenses,
    fetchTotalVisitors,
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

  const uploadFinalVideo = async (orderId: string, file: File) => {
    if (!token) return;
    setUploadingFinal(true);
    setUploadProgress(0);
    setFinalActionMessage(null);
    try {
      const videoUrl = await uploadFileWithProgress(orderId, file, token, (pct) =>
        setUploadProgress(pct)
      );

      const res = await fetch("/api/admin/orders/update", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ orderId, finalVideoUrl: videoUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save video URL");
      }

      setSelectedOrder((prev) =>
        prev && prev.id === orderId
          ? { ...prev, final_video_url: videoUrl }
          : prev
      );
      setFinalActionMessage("Video uploaded.");
      fetchOrders();
    } catch (error) {
      console.error("Upload final video error:", error);
      setFinalActionMessage(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setUploadingFinal(false);
      setUploadProgress(0);
    }
  };

  const sendFinalEmail = async (orderId: string, videoUrl?: string | null) => {
    if (!token) return;
    setSendingFinal(true);
    setFinalActionMessage(null);
    try {
      const res = await fetch("/api/admin/orders/send-final-email", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ orderId, videoUrl: videoUrl ?? undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to send email");
      }
      const sentAt = new Date().toISOString();
      setSelectedOrder((prev) =>
        prev && prev.id === orderId
          ? { ...prev, final_video_sent_at: sentAt, order_status: "completed" }
          : prev
      );
      setFinalActionMessage("Final video email sent.");
      fetchOrders();
    } catch (error) {
      console.error("Send final email error:", error);
      setFinalActionMessage(
        error instanceof Error ? error.message : "Failed to send email"
      );
    } finally {
      setSendingFinal(false);
    }
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

  // Automated emails actions
  const updateEmailSetting = async (key: string, value: string) => {
    setEmailSettings((prev) => ({ ...prev, [key]: value }));
    await fetch("/api/admin/automated-emails-settings", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ [key]: value }),
    });
  };

  const toggleEmailSetting = (key: string) => {
    updateEmailSetting(key, emailSettings[key] === "true" ? "false" : "true");
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
  const savePricingSettings = async () => {
    const overrides: Record<string, Record<string, number>> = {};
    for (const [code, value] of Object.entries(priceOverrides)) {
      const entry: Record<string, number> = {};
      (["base", "customSong", "expressDelivery", "danceExtended"] as const).forEach((key) => {
        const raw = value[key];
        if (raw === "" || raw == null) return;
        const num = Number.parseFloat(raw);
        if (!Number.isNaN(num) && Number.isFinite(num) && num >= 0) {
          entry[key] = num;
        }
      });
      if (Object.keys(entry).length > 0) overrides[code] = entry;
    }

    const res = await fetch("/api/admin/pricing", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ ...pricingSettings, overrides }),
    });
    if (res.ok) {
      alert("Pricing saved");
      fetchPricingSettings();
    } else {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(err?.error ?? "Failed to save pricing");
    }
  };

  const addOverrideCurrency = () => {
    const code = newOverrideCurrency;
    if (!code || priceOverrides[code]) return;
    setPriceOverrides((prev) => ({
      ...prev,
      [code]: { base: "", customSong: "", expressDelivery: "", danceExtended: "" },
    }));
    setNewOverrideCurrency("");
  };

  const removeOverrideCurrency = (code: string) => {
    setPriceOverrides((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const setOverrideValue = (
    code: string,
    key: "base" | "customSong" | "expressDelivery" | "danceExtended",
    value: string
  ) => {
    setPriceOverrides((prev) => ({
      ...prev,
      [code]: { ...prev[code], [key]: value },
    }));
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

    if (paymentStatusFilter !== "all" && order.status !== paymentStatusFilter) {
      return false;
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
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="paid">Paid (default)</option>
                <option value="pending">Pending</option>
                <option value="canceled">Canceled</option>
                <option value="all">All payments</option>
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
                      <th className="text-left p-4 text-white/60 font-medium">Country</th>
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
                        <td className="p-4 text-white/70 text-sm">
                          {order.country ? `${countryCodeToFlag(order.country)} ${order.country}` : "—"}
                        </td>
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
              totalVisitors={totalVisitors}
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
                      <td className="p-4 text-white font-mono">
                        {promo.code}
                        {promo.owner_email && (
                          <span
                            title={`Referral code for ${promo.owner_email}`}
                            className="ml-2 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-sans"
                          >
                            Referral
                          </span>
                        )}
                      </td>
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
              <h3 className="text-lg font-semibold text-white mb-4">Pricing (USD)</h3>
              <p className="text-white/60 text-sm mb-4">
                These prices are used server-side to calculate Stripe/PayPal amounts.
              </p>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Base</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pricingSettings.base}
                      onChange={(e) =>
                        setPricingSettings((p) => ({
                          ...p,
                          base: Number.parseFloat(e.target.value || "0"),
                        }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Custom song</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pricingSettings.customSong}
                      onChange={(e) =>
                        setPricingSettings((p) => ({
                          ...p,
                          customSong: Number.parseFloat(e.target.value || "0"),
                        }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Express delivery</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pricingSettings.expressDelivery}
                      onChange={(e) =>
                        setPricingSettings((p) => ({
                          ...p,
                          expressDelivery: Number.parseFloat(e.target.value || "0"),
                        }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">Dance extended</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pricingSettings.danceExtended}
                      onChange={(e) =>
                        setPricingSettings((p) => ({
                          ...p,
                          danceExtended: Number.parseFloat(e.target.value || "0"),
                        }))
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                </div>

                {/* Per-currency price overrides */}
                <div className="border-t border-white/10 pt-4 mt-2">
                  <h4 className="text-base font-semibold text-white mb-1">
                    Per-currency prices
                  </h4>
                  <p className="text-white/60 text-sm mb-4">
                    Set a fixed price for specific currencies. Leave a field empty to
                    auto-convert that line from the USD price using live rates.
                  </p>

                  <div className="space-y-3">
                    {Object.keys(priceOverrides).length === 0 && (
                      <p className="text-white/40 text-sm">
                        No currency overrides yet — all currencies use automatic conversion.
                      </p>
                    )}

                    {Object.entries(priceOverrides).map(([code, value]) => (
                      <div
                        key={code}
                        className="flex flex-wrap items-end gap-3 bg-white/5 border border-white/10 rounded-lg p-3"
                      >
                        <div className="w-16 shrink-0">
                          <span className="block text-sm font-semibold text-white">
                            {code}
                          </span>
                          <span className="text-white/40 text-xs">
                            {CURRENCY_SYMBOLS[code as keyof typeof CURRENCY_SYMBOLS]}
                          </span>
                        </div>
                        {(["base", "customSong", "expressDelivery", "danceExtended"] as const).map((key) => (
                          <div key={key} className="flex-1 min-w-[110px]">
                            <label className="block text-xs text-white/50 mb-1">
                              {key === "base"
                                ? "Base"
                                : key === "customSong"
                                ? "Custom song"
                                : key === "expressDelivery"
                                ? "Express"
                                : "Dance ext."}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="auto"
                              value={value[key]}
                              onChange={(e) => setOverrideValue(code, key, e.target.value)}
                              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => removeOverrideCurrency(code)}
                          className="p-2 text-white/50 hover:text-red-400 transition-colors"
                          aria-label={`Remove ${code} override`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <select
                      value={newOverrideCurrency}
                      onChange={(e) => setNewOverrideCurrency(e.target.value)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      <option value="">Add currency…</option>
                      {SUPPORTED_CURRENCIES.filter(
                        (c) => c !== "USD" && !priceOverrides[c]
                      ).map((c) => (
                        <option key={c} value={c}>
                          {c} ({CURRENCY_SYMBOLS[c]})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addOverrideCurrency}
                      disabled={!newOverrideCurrency}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>
                </div>

                <button
                  onClick={savePricingSettings}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Save Pricing
                </button>
              </div>
            </div>

            {/* Automated Emails */}
            <div className="glass-card p-6 rounded-xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Automated Emails</h3>
                <p className="text-white/60 text-sm">
                  Emails sent automatically on a schedule, no manual action needed.
                </p>
              </div>

              {/* Review request */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium">Review request (Trustpilot)</p>
                  <p className="text-white/60 text-sm">
                    Sent this many days after the final video is delivered.
                  </p>
                  <input
                    type="number"
                    min="0"
                    value={emailSettings.review_email_delay_days ?? "3"}
                    onChange={(e) => updateEmailSetting("review_email_delay_days", e.target.value)}
                    className="mt-2 w-24 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <button
                  onClick={() => toggleEmailSetting("review_email_enabled")}
                  className={`relative w-14 h-7 shrink-0 rounded-full transition-colors ${
                    emailSettings.review_email_enabled === "true" ? "bg-green-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      emailSettings.review_email_enabled === "true" ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Abandoned cart */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium">Abandoned cart reminder</p>
                  <p className="text-white/60 text-sm">
                    Sent this many hours after an order is left unpaid.
                  </p>
                  <input
                    type="number"
                    min="0"
                    value={emailSettings.abandoned_cart_email_delay_hours ?? "3"}
                    onChange={(e) =>
                      updateEmailSetting("abandoned_cart_email_delay_hours", e.target.value)
                    }
                    className="mt-2 w-24 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <button
                  onClick={() => toggleEmailSetting("abandoned_cart_email_enabled")}
                  className={`relative w-14 h-7 shrink-0 rounded-full transition-colors ${
                    emailSettings.abandoned_cart_email_enabled === "true" ? "bg-green-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      emailSettings.abandoned_cart_email_enabled === "true" ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Shared winback promo code (cross-sell + annual reminder) */}
              <div>
                <p className="text-white font-medium">Winback promo code</p>
                <p className="text-white/60 text-sm">
                  Code mentioned in the cross-sell and annual reminder emails below (create it
                  first in the Promo tab).
                </p>
                <input
                  type="text"
                  value={emailSettings.winback_promo_code ?? ""}
                  onChange={(e) => updateEmailSetting("winback_promo_code", e.target.value)}
                  placeholder="e.g. COMEBACK15"
                  className="mt-2 w-48 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Cross-sell */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium">Cross-sell (&quot;another birthday?&quot;)</p>
                  <p className="text-white/60 text-sm">
                    Sent this many days after the final video is delivered.
                  </p>
                  <input
                    type="number"
                    min="0"
                    value={emailSettings.cross_sell_email_delay_days ?? "7"}
                    onChange={(e) =>
                      updateEmailSetting("cross_sell_email_delay_days", e.target.value)
                    }
                    className="mt-2 w-24 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <button
                  onClick={() => toggleEmailSetting("cross_sell_email_enabled")}
                  className={`relative w-14 h-7 shrink-0 rounded-full transition-colors ${
                    emailSettings.cross_sell_email_enabled === "true" ? "bg-green-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      emailSettings.cross_sell_email_enabled === "true" ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Annual reminder */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium">Annual reminder</p>
                  <p className="text-white/60 text-sm">
                    Sent this many days after the original order date.
                  </p>
                  <input
                    type="number"
                    min="0"
                    value={emailSettings.annual_reminder_email_delay_days ?? "365"}
                    onChange={(e) =>
                      updateEmailSetting("annual_reminder_email_delay_days", e.target.value)
                    }
                    className="mt-2 w-24 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <button
                  onClick={() => toggleEmailSetting("annual_reminder_email_enabled")}
                  className={`relative w-14 h-7 shrink-0 rounded-full transition-colors ${
                    emailSettings.annual_reminder_email_enabled === "true" ? "bg-green-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      emailSettings.annual_reminder_email_enabled === "true" ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {/* Referral program */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-medium">Referral program</p>
                  <p className="text-white/60 text-sm">
                    Sends each customer a personal code this many days after delivery; rewards
                    them when a friend uses it.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-white/50">
                      Delay (days)
                      <input
                        type="number"
                        min="0"
                        value={emailSettings.referral_email_delay_days ?? "3"}
                        onChange={(e) =>
                          updateEmailSetting("referral_email_delay_days", e.target.value)
                        }
                        className="block w-20 mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      Friend discount %
                      <input
                        type="number"
                        min="0"
                        value={emailSettings.referral_friend_discount_value ?? "15"}
                        onChange={(e) =>
                          updateEmailSetting("referral_friend_discount_value", e.target.value)
                        }
                        className="block w-20 mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      Max uses/code
                      <input
                        type="number"
                        min="1"
                        value={emailSettings.referral_max_uses ?? "5"}
                        onChange={(e) => updateEmailSetting("referral_max_uses", e.target.value)}
                        className="block w-20 mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      Reward %
                      <input
                        type="number"
                        min="0"
                        value={emailSettings.referral_reward_value ?? "15"}
                        onChange={(e) =>
                          updateEmailSetting("referral_reward_value", e.target.value)
                        }
                        className="block w-20 mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </label>
                  </div>
                </div>
                <button
                  onClick={() => toggleEmailSetting("referral_email_enabled")}
                  className={`relative w-14 h-7 shrink-0 rounded-full transition-colors ${
                    emailSettings.referral_email_enabled === "true" ? "bg-green-500" : "bg-white/20"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      emailSettings.referral_email_enabled === "true" ? "left-8" : "left-1"
                    }`}
                  />
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
                <div>
                  <p className="text-white/60 text-sm">Dance extended</p>
                  <p className="text-white">{selectedOrder.dance_extended ? "Yes" : "No"}</p>
                </div>
              </div>
              <div>
                <p className="text-white/60 text-sm">Message</p>
                <p className="text-white bg-white/5 p-3 rounded-lg mt-1">
                  {selectedOrder.message}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Photo</p>
                {selectedOrder.photo_url ? (
                  <a
                    href={selectedOrder.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 mt-1"
                  >
                    View Photo <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <p className="text-white/40 text-sm mt-1 italic">Deleted (order completed 30+ days ago)</p>
                )}
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

              {/* Final video delivery */}
              <div className="border-t border-white/10 pt-4 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Video className="w-5 h-5 text-orange-400" />
                  <h3 className="text-white font-semibold">Final video</h3>
                </div>

                {selectedOrder.final_video_url ? (
                  <div className="space-y-2 mb-3">
                    <a
                      href={selectedOrder.final_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm break-all"
                    >
                      {selectedOrder.final_video_url}
                      <ExternalLink className="w-4 h-4 shrink-0" />
                    </a>
                    {selectedOrder.final_video_sent_at && (
                      <p className="flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Sent on{" "}
                        {new Date(selectedOrder.final_video_sent_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-white/60 text-sm mb-3">
                    No final video uploaded yet.
                  </p>
                )}

                <div className="flex flex-wrap gap-3 items-center">
                  <label
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                      uploadingFinal
                        ? "bg-white/5 text-white/40 cursor-not-allowed"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingFinal
                      ? `Uploading… ${uploadProgress}%`
                      : selectedOrder.final_video_url
                      ? "Replace video"
                      : "Upload video"}
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={uploadingFinal}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadFinalVideo(selectedOrder.id, file);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      sendFinalEmail(
                        selectedOrder.id,
                        selectedOrder.final_video_url
                      )
                    }
                    disabled={
                      sendingFinal ||
                      uploadingFinal ||
                      !selectedOrder.final_video_url
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-purple-600 text-white font-medium hover:from-orange-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    title={
                      !selectedOrder.final_video_url
                        ? "Upload a video first"
                        : "Send the final video email to the customer"
                    }
                  >
                    <Send className="w-4 h-4" />
                    {sendingFinal
                      ? "Sending…"
                      : selectedOrder.final_video_sent_at
                      ? "Resend final email"
                      : "Send final email"}
                  </button>
                </div>

                {finalActionMessage && (
                  <p className="text-sm text-white/70 mt-3">
                    {finalActionMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
