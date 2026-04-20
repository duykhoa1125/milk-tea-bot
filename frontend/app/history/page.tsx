"use client";
import { useEffect, useState, useCallback } from "react";
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  ShoppingBag,
  CircleDollarSign
} from "lucide-react";
import { format } from "date-fns";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

export default function HistoryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders/history?status=${filter}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setOrders(data.data || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const stats = [
    { label: "Total Orders", value: orders.length, icon: ShoppingBag, color: "bg-blue-500" },
    { label: "Revenue", value: `${orders.reduce((acc, o) => acc + (o.totalPrice || 0), 0).toLocaleString()}đ`, icon: CircleDollarSign, color: "bg-emerald-500" },
    { label: "Completion Rate", value: orders.length ? `${Math.round((orders.filter(o => o.status === "DONE").length / orders.length) * 100)}%` : "0%", icon: TrendingUp, color: "bg-orange-500" },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-foreground flex items-center gap-3">
            <History className="text-primary" size={32} />
            History <span className="text-primary italic font-serif">Logs</span>
          </h1>
          <p className="text-secondary mt-2">Track and manage your past order records.</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-border">
          {["ALL", "DONE", "CANCELLED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                filter === f 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-secondary hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat, i) => (
          <div key={i} className="modern-card p-6 flex items-center gap-6">
            <div className={`w-14 h-14 ${stat.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-sm font-bold text-secondary uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-black text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main List */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Recent Orders</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
              <input 
                type="text" 
                placeholder="Search orders..." 
                className="pl-10 pr-4 py-2 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-64"
              />
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="modern-card p-6 h-32 animate-pulse bg-gray-100" />
              ))
            ) : orders.length === 0 ? (
              <div className="modern-card p-12 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <History size={40} />
                </div>
                <p className="text-secondary font-bold">No orders found matching your filter.</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="modern-card group p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                      order.status === 'DONE' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
                    }`}>
                      {order.status === 'DONE' ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg">Order #{order.id}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                          order.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-secondary text-sm flex items-center gap-2 mt-1">
                        <Clock size={14} />
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </p>
                      <div className="flex gap-2 mt-2">
                         {order.items.map((item: any, idx: number) => (
                            <span key={idx} className="bg-gray-100 text-[10px] px-2 py-0.5 rounded-md font-bold text-secondary">
                              {item.quantity}x {item.product.name}
                            </span>
                         ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-8">
                    <div className="text-right">
                      <p className="text-xs font-bold text-secondary uppercase tracking-tighter mb-1">Total Amount</p>
                      <p className="text-xl font-black text-primary">{(order.totalPrice || 0).toLocaleString()}đ</p>
                    </div>
                    <button className="w-12 h-12 rounded-2xl border border-border flex items-center justify-center text-secondary hover:border-primary hover:text-primary transition-all duration-300">
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Side Panel: Insights (Matches the image's right vertical layout) */}
        <div className="lg:col-span-4 space-y-8">
          {/* Top Selling Block */}
          <div className="modern-card p-6 bg-gradient-to-br from-primary to-orange-600 text-white shadow-xl shadow-primary/20">
            <h3 className="text-xl font-black mb-1">Weekly Summary</h3>
            <p className="text-white/70 text-sm mb-6">Your kitchen performance this week.</p>
            
            <div className="space-y-4">
               <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold">Preparation Speed</span>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Top 5%</span>
                 </div>
                 <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                    <div className="bg-white h-full w-[85%]" />
                 </div>
               </div>

               <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold">Customer Satisfaction</span>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">4.9/5.0</span>
                 </div>
                 <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                    <div className="bg-white h-full w-[98%]" />
                 </div>
               </div>
            </div>

            <button className="w-full bg-white text-primary font-black py-4 rounded-2xl mt-8 flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors">
              Download Report
              <ArrowUpRight size={18} />
            </button>
          </div>

          {/* Featured Offer Block */}
          <div className="modern-card p-6 overflow-hidden relative min-h-[300px] flex flex-col justify-end">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://images.unsplash.com/photo-1544787210-22bb83063857?q=80&w=1911&auto=format&fit=crop')] bg-cover bg-center" />
            <div className="relative z-10">
              <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">Flash Insight</span>
              <h3 className="text-2xl font-black text-foreground leading-tight mb-2">Optimize your <span className="text-primary">Peak Hours</span></h3>
              <p className="text-secondary text-sm mb-6">Most orders happen between 2PM and 4PM. Consider adding more staff during this window.</p>
              <button className="flex items-center gap-2 text-primary font-black group">
                Learn more
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
