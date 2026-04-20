"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  History, 
  MessageSquare, 
  User, 
  ClipboardList,
  Bell,
  LogOut
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { icon: LayoutDashboard, path: "/", label: "Dashboard" },
    { icon: ClipboardList, path: "/orders", label: "Orders" },
    { icon: History, path: "/history", label: "History" },
    { icon: MessageSquare, path: "/chat", label: "Messages" },
    { icon: User, path: "/profile", label: "Profile" },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-[80px] bg-white border-r border-border flex flex-col items-center py-8 z-50">
      {/* Logo */}
      <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mb-12 shadow-lg shadow-primary/30">
        <div className="text-white font-bold text-xl">M</div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-8">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`p-3 rounded-2xl transition-all duration-300 group relative ${
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-secondary hover:bg-primary/5 hover:text-primary"
              }`}
            >
              <item.icon size={24} strokeWidth={2} />
              
              {/* Tooltip */}
              <span className="absolute left-20 bg-foreground text-background px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
                {item.label}
              </span>
              
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-6 mt-auto">
        <button className="text-secondary hover:text-primary transition-colors p-2">
          <Bell size={24} />
        </button>
        <button className="text-secondary hover:text-rose-500 transition-colors p-2">
          <LogOut size={24} />
        </button>
      </div>
    </div>
  );
}
