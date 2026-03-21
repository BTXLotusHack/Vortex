import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/dashboard";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid email or password.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,hsl(165_26%_10%)_0%,hsl(168_24%_8%)_35%,hsl(44_35%_92%)_130%)] lg:flex">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,hsl(43_50%_70%/0.16),transparent_18%),radial-gradient(circle_at_82%_18%,hsl(160_55%_34%/0.14),transparent_30%),radial-gradient(circle_at_68%_72%,hsl(42_46%_80%/0.12),transparent_24%)]" />
        <div className="absolute inset-y-0 left-[44%] w-px bg-gradient-to-b from-transparent via-white/8 to-transparent blur-sm" />
      </div>

      <div className="relative hidden overflow-hidden p-12 lg:flex lg:w-[48%] lg:items-end">
        <div className="relative z-10 max-w-lg">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(42_52%_78%)]">
              <span className="font-display text-xl text-[hsl(165_25%_12%)]">V</span>
            </div>
            <span className="font-display text-2xl text-white/90">VORTEX</span>
          </div>
          <h2 className="font-display text-5xl leading-[1.02] text-white">
            Enter a smoother kind of interview prep.
          </h2>
          <p className="mt-5 text-base leading-8 text-white/60">
            AI-powered CV analysis, voice rehearsal, and technical rounds wrapped in
            a calmer, more premium workflow.
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 py-8 lg:px-10">
        <div
          className="surface-glass w-full max-w-md rounded-[2rem] border border-white/45 p-7 opacity-0 animate-fade-up md:p-8"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="mb-8">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <span className="font-display text-lg text-primary-foreground">V</span>
              </div>
              <span className="font-display text-xl">VORTEX</span>
            </div>
            <div className="mb-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              Welcome back
            </div>
            <h1 className="font-display text-4xl leading-none">Sign in</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Continue your prep with the latest scores, feedback, and practice history.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
