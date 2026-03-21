import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await forgotPassword({ email });
      toast.success("If the email exists, a reset code has been sent.");
      navigate("/reset-password", {
        replace: true,
        state: { email },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to send the password reset code.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,hsl(165_26%_10%)_0%,hsl(168_24%_8%)_35%,hsl(44_35%_92%)_130%)] lg:flex">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,hsl(43_50%_70%/0.16),transparent_18%),radial-gradient(circle_at_82%_18%,hsl(160_55%_34%/0.14),transparent_30%),radial-gradient(circle_at_74%_74%,hsl(42_46%_80%/0.12),transparent_26%)]" />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 py-8 lg:px-10">
        <div
          className="surface-glass w-full max-w-md rounded-[2rem] border border-white/45 p-7 opacity-0 animate-fade-up md:p-8"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="mb-8">
            <div className="mb-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              Recover access
            </div>
            <h1 className="font-display text-4xl leading-none">Forgot password</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Enter your account email and we&apos;ll send a 6-digit OTP to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-primary/15 bg-white/40 px-4 py-3 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <Mail className="h-4 w-4 text-primary" />
                Password reset by OTP
              </div>
              The reset code is sent by email and expires after a short time for safety.
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Send reset OTP <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
