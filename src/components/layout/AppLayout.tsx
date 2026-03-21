import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  FileText,
  Mic,
  Code2,
  BarChart3,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  LogIn,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "CV Screening", href: "/cv-screening", icon: FileText },
  { label: "Voice Interview", href: "/voice-interview", icon: Mic },
  { label: "Technical", href: "/technical-interview", icon: Code2 },
  { label: "Results", href: "/results", icon: BarChart3 },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    if (!user){
      navigate("/login");
    }
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <img src="./favicon.ico" alt="VORTEX" className="h-6 w-6 rounded-sm object-cover" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-sidebar-accent-foreground tracking-tight text-lg">
              VORTEX
            </span>
            <span className="text-xs text-sidebar-accent-foreground/90 uppercase">AI</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-4 border-t border-sidebar-border">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-sidebar-foreground/70 truncate">{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
            >
              <LogIn className="h-3 w-3" /> Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="md:hidden flex h-14 items-center justify-between px-4 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <img src="/favicon.ico" alt="VORTEX" className="h-5 w-5 rounded-sm object-cover" />
            </div>
            <span className="font-semibold text-sm">InterviewPrep</span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-md hover:bg-secondary active:scale-95 transition-transform"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <nav className="md:hidden bg-card border-b px-4 py-2 space-y-1 animate-fade-in">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
