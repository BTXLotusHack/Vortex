import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSuccess(true);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,hsl(165_26%_10%)_0%,hsl(168_24%_8%)_35%,hsl(44_35%_92%)_130%)] lg:flex">
      <div className="relative hidden overflow-hidden p-12 lg:flex lg:w-[48%] lg:items-end">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,hsl(43_50%_70%/0.16),transparent_18%),radial-gradient(circle_at_bottom_left,hsl(160_55%_34%/0.22),transparent_40%)]" />
        <div className="relative z-10 max-w-lg">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(42_52%_78%)]">
              <span className="font-display text-xl text-[hsl(165_25%_12%)]">V</span>
            </div>
            <span className="font-display text-2xl text-white/90">VORTEX</span>
          </div>
          <h2 className="font-display text-5xl leading-[1.02] text-white">
            Build interview confidence with more polish from day one.
          </h2>
          <p className="mt-5 text-base leading-8 text-white/60">
            Create an account to unlock refined feedback loops across CV review,
            voice performance, and technical practice.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-8 lg:px-10">
        <div
          className="surface-glass w-full max-w-md rounded-[2rem] border border-white/45 p-7 opacity-0 animate-fade-up md:p-8"
          style={{ animationFillMode: "forwards" }}
        >
          {success ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <h1 className="font-display text-4xl">Check your email</h1>
              <p className="text-sm leading-7 text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Click it to
                activate your account.
              </p>
              <Link to="/login" className="text-sm font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="mb-6 flex items-center gap-2 lg:hidden">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                    <span className="font-display text-lg text-primary-foreground">V</span>
                  </div>
                  <span className="font-display text-xl">VORTEX</span>
                </div>
                <div className="mb-3 text-[11px] uppercase tracking-[0.28em] text-primary">
                  Get started
                </div>
                <h1 className="font-display text-4xl leading-none">Create your account</h1>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Start your interview prep journey with a cleaner, more premium workspace.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
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
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Create account <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
