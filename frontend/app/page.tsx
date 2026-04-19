"use client";
import { useEffect, useState, useCallback } from "react";
import OrderCard from "@/components/OrderCard";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

export default function KitchenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders`);
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
    <main className="min-h-screen p-4 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Menu Header */}
        <header className="mb-12 text-center relative py-8 border-y-2 border-accent/20">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] font-black text-accent/40">
            Established 2024
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-accent mb-2">
            Kitchen Dashboard
          </h1>
          <p className="font-serif italic text-lg text-accent/60">
            Freshly Brewed Order Management
          </p>
          <div className="mt-4 flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase font-black text-gray-400">
              Current Sync Time
            </span>
            <span className="text-sm font-bold text-accent">
              {lastUpdate.toLocaleTimeString("vi-VN")}
            </span>
          </div>
        </header>

        {/* Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Section: Pending */}
          <section>
            <div className="flex items-baseline justify-between mb-8 border-b border-accent/10 pb-2">
              <h2 className="font-serif text-3xl text-accent">Pending Orders</h2>
              <span className="font-serif italic text-xl text-accent/40">
                {pending.length} in queue
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-10">
              {pending.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  backendUrl={BACKEND_URL}
                  onStatusChange={fetchOrders}
                />
              ))}
              {pending.length === 0 && !loading && (
                <div className="py-20 text-center border-2 border-dashed border-accent/10 rounded-xl">
                  <p className="font-serif italic text-accent/40">No new orders at the moment</p>
                </div>
              )}
            </div>
          </section>

          {/* Section: Cooking */}
          <section>
            <div className="flex items-baseline justify-between mb-8 border-b border-accent/10 pb-2">
              <h2 className="font-serif text-3xl text-accent">In Preparation</h2>
              <span className="font-serif italic text-xl text-accent/40">
                {cooking.length} active
              </span>
            </div>

            <div className="grid grid-cols-1 gap-10">
              {cooking.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  backendUrl={BACKEND_URL}
                  onStatusChange={fetchOrders}
                />
              ))}
              {cooking.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-accent/10 rounded-xl">
                  <p className="font-serif italic text-accent/40">The preparation area is clear</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}


