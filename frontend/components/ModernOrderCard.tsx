"use client";
import { useState } from "react";
import { Clock, User, Coffee, ChevronRight, Check, Loader2 } from "lucide-react";

interface OrderCardProps {
  order: any;
  backendUrl: string;
  onStatusChange: () => void;
}

export default function ModernOrderCard({
  order,
  backendUrl,
  onStatusChange,
}: OrderCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`${backendUrl}/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      onStatusChange();
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusConfig = {
    PENDING: { label: "Pending", class: "badge-pending", icon: Clock },
    COOKING: { label: "Preparing", class: "badge-cooking", icon: Coffee },
    DONE: { label: "Ready", class: "badge-done", icon: Check },
    CANCELLED: { label: "Cancelled", class: "bg-rose-100 text-rose-700", icon: Check },
  };

  const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.PENDING;

  return (
    <div className="modern-card p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center font-black">
            #{order.id.toString().slice(-4)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`badge ${config.class}`}>{config.label}</span>
            </div>
            <p className="text-sm text-secondary flex items-center gap-1 mt-1">
              <Clock size={12} />
              {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-secondary uppercase tracking-widest">Total</p>
          <p className="text-lg font-black text-foreground">{(order.totalPrice || 0).toLocaleString()}đ</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <User size={14} className="text-secondary" />
          <span className="text-sm font-bold text-foreground">{order.user?.name || "Anonymous Guest"}</span>
        </div>
        
        <ul className="space-y-3">
          {order.items.map((item: any) => (
            <li key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-transparent hover:border-primary/20 transition-all">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 bg-white border border-border rounded-lg flex items-center justify-center text-[10px] font-black text-primary">
                  {item.quantity}
                </span>
                <span className="text-sm font-bold text-foreground">{item.product.name}</span>
              </div>
              <span className="text-[10px] font-black text-secondary uppercase bg-white px-2 py-0.5 rounded-md border border-border">
                {item.size}
              </span>
            </li>
          ))}
        </ul>

        {order.note && (
          <div className="mt-4 p-3 bg-primary/5 rounded-xl border-l-4 border-primary text-xs italic text-primary/80 font-medium">
            "{order.note}"
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex gap-3">
        {order.status === "PENDING" && (
          <button
            onClick={() => updateStatus("COOKING")}
            disabled={isUpdating}
            className="modern-button modern-button-primary flex-1 group"
          >
            {isUpdating ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                Start Preparation
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        )}
        {order.status === "COOKING" && (
          <button
            onClick={() => updateStatus("DONE")}
            disabled={isUpdating}
            className="modern-button flex-1 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 group"
          >
            {isUpdating ? <Loader2 className="animate-spin" size={20} /> : (
               <>
                Mark as Ready
                <Check size={18} className="group-hover:scale-125 transition-transform" />
              </>
            )}
          </button>
        )}
        {(order.status === "DONE" || order.status === "CANCELLED") && (
          <button className="modern-button-secondary flex-1">
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
