import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const fallbackEmail =
    typeof location.state?.email === "string" ? location.state.email : "";
  const [email, setEmail] = useState(fallbackEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(email && otp.length === 6 && password.length >= 8 && password === confirmPassword);
  }, [confirmPassword, email, otp.length, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ email, otp, password });
      toast.success("Password reset successfully. Please sign in again.");
      navigate("/login", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reset password.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,hsl(165_26%_10%)_0%,hsl(168_24%_8%)_35%,hsl(44_35%_92%)_130%)] lg:flex">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,hsl(43_50%_70%/0.16),transparent_18%),radial-gradient(circle_at_82%_18%,hsl(160_55%_34%/0.14),transparent_30%),radial-gradient(circle_at_68%_72%,hsl(42_46%_80%/0.12),transparent_24%)]" />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 py-8 lg:px-10">
        <div
          className="surface-glass w-full max-w-md rounded-[2rem] border border-white/45 p-7 opacity-0 animate-fade-up md:p-8"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="mb-8">
            <div className="mb-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              Finish reset
            </div>
            <h1 className="font-display text-4xl leading-none">Reset password</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Enter the 6-digit OTP from your email and set a new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-primary/15 bg-white/40 px-4 py-3 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Secure reset
              </div>
              We verify your email OTP before allowing a new password.
            </div>

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
              <Label htmlFor="otp">OTP code</Label>
              <InputOTP
                id="otp"
                maxLength={6}
                pattern="[0-9]*"
                value={otp}
                onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                required
                autoComplete="one-time-code"
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="h-12 w-12 rounded-xl border border-white/40 bg-white/55 text-base font-semibold backdrop-blur"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Update password <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need a new code?{" "}
            <Link to="/forgot-password" className="font-medium text-primary hover:underline">
              Send another OTP
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
