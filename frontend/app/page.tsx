"use client";
import { useEffect, useState, useCallback } from "react";
import ModernOrderCard from "@/components/ModernOrderCard";
import { LayoutDashboard, Clock, RefreshCcw, TrendingUp, AlertCircle, ShoppingCart } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

export default function KitchenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders`, {
        headers: {
          "x-admin-key": ADMIN_API_KEY,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setOrders(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const pending = orders.filter((o) => o.status === "PENDING");
  const cooking = orders.filter((o) => o.status === "COOKING");

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-foreground flex items-center gap-3">
            <LayoutDashboard className="text-primary" size={32} />
            Kitchen <span className="text-primary italic font-serif">Dashboard</span>
          </h1>
          <p className="text-secondary mt-2 flex items-center gap-2">
            <Clock size={16} />
            Last synced at {lastUpdate.toLocaleTimeString("vi-VN")}
          </p>
        </div>
        
        <button 
          onClick={fetchOrders}
          disabled={loading}
          className="modern-button modern-button-secondary"
        >
          <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          Refresh Now
        </button>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="modern-card p-6 bg-white flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-secondary uppercase">Waiting</p>
              <p className="text-2xl font-black">{pending.length} Orders</p>
            </div>
          </div>
          <div className="modern-card p-6 bg-white flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-secondary uppercase">Preparing</p>
              <p className="text-2xl font-black">{cooking.length} Active</p>
            </div>
          </div>
          <div className="modern-card p-6 bg-primary text-white flex items-center gap-4 shadow-xl shadow-primary/20">
            <div className="w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center backdrop-blur-md">
              <ShoppingCart size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-white/70 uppercase">Total Today</p>
              <p className="text-2xl font-black">{orders.length} Orders</p>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Pending Orders */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-foreground">Waiting Queue</h2>
            <span className="badge badge-pending">{pending.length} New</span>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {pending.map((o) => (
              <ModernOrderCard
                key={o.id}
                order={o}
                backendUrl={BACKEND_URL}
                onStatusChange={fetchOrders}
              />
            ))}
            {pending.length === 0 && !loading && (
              <div className="modern-card p-20 text-center border-dashed border-2 bg-transparent">
                <p className="text-secondary font-bold">No orders in queue</p>
              </div>
            )}
          </div>
        </section>

        {/* Cooking Orders */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-foreground">Preparation Area</h2>
            <span className="badge badge-cooking">{cooking.length} Active</span>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {cooking.map((o) => (
              <ModernOrderCard
                key={o.id}
                order={o}
                backendUrl={BACKEND_URL}
                onStatusChange={fetchOrders}
              />
            ))}
            {cooking.length === 0 && (
              <div className="modern-card p-20 text-center border-dashed border-2 bg-transparent">
                <p className="text-secondary font-bold">Preparation area is empty</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
