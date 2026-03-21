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
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[hsl(155,12%,6%)] relative overflow-hidden items-end p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(152,55%,34%,0.15),transparent_60%)]" />
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-[hsl(152,55%,46%)] flex items-center justify-center">
              <span className="text-white font-bold text-lg">IP</span>
            </div>
            <span className="text-white/90 font-semibold text-xl tracking-tight">InterviewPrep</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-[1.15]" style={{ lineHeight: "1.15" }}>
            Start practicing today — for free.
          </h2>
          <p className="mt-4 text-white/50 text-base leading-relaxed">
            Get instant AI feedback on your CV, practice voice answers, and nail technical questions.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-sm opacity-0 animate-fade-up"
          style={{ animationFillMode: "forwards" }}
        >
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-muted-foreground text-sm">
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </p>
              <Link to="/login" className="text-primary text-sm font-medium hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="lg:hidden flex items-center gap-2 mb-6">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">IP</span>
                  </div>
                  <span className="font-semibold tracking-tight">InterviewPrep</span>
                </div>
                <h1 className="text-2xl font-bold">Create your account</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Start your interview prep journey
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

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">
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
