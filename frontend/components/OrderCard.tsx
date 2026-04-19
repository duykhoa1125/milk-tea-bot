"use client";
import { useState } from "react";

interface OrderCardProps {
  order: any;
  backendUrl: string;
  onStatusChange: () => void;
}

export default function OrderCard({
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

  const stampColor = order.status === "PENDING" ? "text-rose-800/20 border-rose-800/20" : "text-amber-800/20 border-amber-800/20";

  return (
    <div className="menu-ticket p-8 relative flex flex-col group transition-all duration-300 hover:-translate-y-1">
      {/* Visual Stamp Effect */}
      <div className={`absolute top-6 right-6 border-4 rounded-lg px-2 py-1 font-black text-2xl uppercase -rotate-12 pointer-events-none select-none tracking-tighter transition-all duration-500 group-hover:rotate-0 group-hover:scale-110 ${stampColor}`}>
        {order.status}
      </div>

      <header className="mb-6 flex justify-between items-end border-b-2 border-accent/10 pb-4">
        <div>
          <span className="text-[10px] uppercase font-black text-accent/40 block mb-1">Receipt No.</span>
          <span className="font-serif text-4xl text-accent">#{order.id.toString().padStart(4, '0')}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-black text-accent/40 block mb-1">Customer</span>
          <span className="font-serif italic text-lg text-accent/80">{order.user?.name || "Guest"}</span>
        </div>
      </header>

      <div className="flex-1">
        <span className="text-[10px] uppercase font-black text-accent/40 block mb-4">Ordered Items</span>
        <ul className="space-y-4 mb-6">
          {order.items.map((item: any) => (
            <li key={item.id} className="relative">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-serif text-lg text-accent flex-1 flex items-baseline">
                  <span className="font-sans font-black mr-3 text-sm bg-accent text-white px-1.5 rounded uppercase">{item.quantity}</span>
                  {item.product.name}
                  <span className="mx-2 flex-1 border-b border-dotted border-accent/20"></span>
                </span>
                <span className="font-serif italic text-accent/60 ml-2">{item.size}</span>
              </div>
              {item.note && (
                <div className="pl-10 text-xs text-amber-700 italic flex items-center gap-1">
                  <span>↳</span> {item.note}
                </div>
              )}
            </li>
          ))}
        </ul>

        {order.note && (
          <div className="bg-background/50 p-4 rounded border-l-2 border-accent/20 mb-8 italic text-sm text-accent/70 font-serif">
            Note: "{order.note}"
          </div>
        )}
      </div>

      <footer className="mt-auto pt-6 border-t border-accent/10">
        {order.status === "PENDING" && (
          <button
            onClick={() => updateStatus("COOKING")}
            disabled={isUpdating}
            className="w-full bg-accent text-white font-serif italic text-lg py-3 rounded hover:bg-black transition-colors disabled:opacity-50"
          >
            {isUpdating ? "Processing..." : "Prepare Order"}
          </button>
        )}
        {order.status === "COOKING" && (
          <button
            onClick={() => updateStatus("DONE")}
            disabled={isUpdating}
            className="w-full bg-[#4caf50] text-white font-serif italic text-lg py-3 rounded hover:bg-[#3d8b40] transition-colors disabled:opacity-50"
          >
            {isUpdating ? "Processing..." : "Mark as Served"}
          </button>
        )}
      </footer>
    </div>
  );
}


