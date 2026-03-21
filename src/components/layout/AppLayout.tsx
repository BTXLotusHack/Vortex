import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  FileText,
  Mic,
  Code2,
  BarChart3,
  LayoutDashboard,
  Settings2,
  Menu,
  X,
  LogOut,
  LogIn,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, meta: "Overview" },
  { label: "CV Screening", href: "/cv-screening", icon: FileText, meta: "Practice module" },
  { label: "Voice Interview", href: "/voice-interview", icon: Mic, meta: "Practice module" },
  { label: "Technical", href: "/technical-interview", icon: Code2, meta: "Practice module" },
  { label: "Results", href: "/results", icon: BarChart3, meta: "Progress history" },
  { label: "Account", href: "/account", icon: Settings2, meta: "Profile & security" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    if (!user) {
      navigate("/");
      return;
    }

    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-transparent text-foreground md:flex md:items-start md:gap-5 md:px-5 md:py-5">
      <aside className="noise-overlay hidden h-[calc(100vh-2.5rem)] w-[280px] shrink-0 flex-col overflow-hidden rounded-[2rem] border border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground shadow-[0_24px_80px_hsl(166_35%_8%/0.35)] md:sticky md:top-5 md:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(44_50%_70%/0.12),transparent_34%),linear-gradient(180deg,hsl(164_30%_16%/0.96),hsl(167_22%_10%/0.98))]" />

        <div className="relative flex shrink-0 items-center gap-4 border-b border-sidebar-border/80 px-6 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_14px_36px_hsl(45_60%_70%/0.12)]">
            <img src="./favicon.png" alt="VORTEX" className="h-7 w-7 rounded-lg object-cover" />
          </div>
          <div className="min-w-0 flex flex-col leading-none">
            <span className="font-display text-2xl text-sidebar-accent-foreground">VORTEX</span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.28em] text-sidebar-foreground/60">
              Interview OS
            </span>
          </div>
        </div>

        <nav className="relative min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_14px_32px_hsl(45_70%_75%/0.16)]"
                    : "text-sidebar-foreground/78 hover:bg-sidebar-accent/95 hover:text-sidebar-accent-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                    active ? "border-black/10 bg-black/10" : "border-white/10 bg-white/5"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "text-[11px]",
                      active
                        ? "text-sidebar-primary-foreground/70"
                        : "text-sidebar-foreground/45"
                    )}
                  >
                    {item.meta}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="relative shrink-0 border-t border-sidebar-border/80 px-6 py-4">
          {user ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.28em] text-sidebar-foreground/45">
                  Signed In
                </div>
                <div className="flex items-center gap-3">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="h-9 w-9 rounded-full" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-sidebar-accent-foreground">
                      {user.name}
                    </div>
                    <div className="truncate text-xs text-sidebar-foreground/50">
                      Ready for another round
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-1 text-xs text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-xs text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground"
            >
              <LogIn className="h-3 w-3" /> Sign in
            </Link>
          )}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 mx-3 mt-3 flex h-16 items-center justify-between rounded-[1.6rem] border border-white/50 bg-white/70 px-4 shadow-luxe backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <img src="./favicon.png" alt="VORTEX" className="h-5 w-5 rounded-sm object-cover" />
            </div>
            <div>
              <span className="font-display text-lg">VORTEX</span>
              <p className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
                Interview OS
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-xl border border-border/60 p-2 transition-transform hover:bg-secondary active:scale-95"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {mobileOpen && (
          <nav className="mx-3 mt-3 space-y-1 rounded-[1.6rem] border border-white/50 bg-white/75 p-3 shadow-luxe backdrop-blur md:hidden animate-fade-in">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <main className="flex-1 px-3 pb-3 md:px-0 md:pb-0 md:pr-3">{children}</main>
      </div>
    </div>
  );
}
