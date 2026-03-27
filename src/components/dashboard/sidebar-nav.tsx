"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, PenSquare, CalendarClock, BarChart3, Sparkles, Settings, Puzzle, Wand2, CreditCard, CalendarDays, MessageSquare, Link2, Rss, Zap, ClipboardCheck, Radio } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/setup/zero-presence", label: "Quick Setup", icon: Zap },
  { href: "/dashboard/profiles", label: "Profiles", icon: Users },
  { href: "/dashboard/compose", label: "Compose", icon: PenSquare },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/dashboard/social", label: "Social Agent", icon: Radio },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/ai", label: "AI Drafts", icon: Sparkles },
  { href: "/dashboard/biolink", label: "Link in Bio", icon: Link2 },
  { href: "/dashboard/links", label: "Link Shortener", icon: Rss },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/setup", label: "Setup Agent", icon: Wand2 },
  { href: "/dashboard/settings/developer-apps", label: "Developer Apps", icon: Puzzle },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-3 space-y-0.5">
      {NAV.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-gray-100 text-black font-medium"
                : "text-gray-600 hover:bg-gray-50 hover:text-black"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
