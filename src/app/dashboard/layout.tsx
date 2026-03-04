import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Zap } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-base">Fanout</span>
          </Link>
        </div>

        <SidebarNav />

        <div className="p-4 border-t border-gray-100">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
