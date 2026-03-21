import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[hsl(155,12%,6%)] relative overflow-hidden items-end p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(152,55%,34%,0.15),transparent_60%)]" />
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-[hsl(152,55%,46%)] flex items-center justify-center">
              <span className="text-white font-bold text-lg">IP</span>
            </div>
            <span className="text-white/90 font-semibold text-xl tracking-tight">InterviewPrep</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-[1.15]" style={{ lineHeight: "1.15" }}>
            Ace every stage of your next interview.
          </h2>
          <p className="mt-4 text-white/50 text-base leading-relaxed">
            AI-powered CV analysis, voice practice, and technical mock interviews — all in one place.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-sm opacity-0 animate-fade-up"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="mb-8">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">IP</span>
              </div>
              <span className="font-semibold tracking-tight">InterviewPrep</span>
            </div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Sign in to continue your prep
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
                placeholder="••••••••"
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

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
