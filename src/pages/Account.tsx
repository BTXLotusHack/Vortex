import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  UserRound,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";

export default function Account() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user?.email, user?.name]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await updateProfile({ name, email });
      toast.success("Profile updated successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update profile.";
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to change password.";
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteLoading(true);
    try {
      await deleteAccount({ password: deletePassword });
      toast.success("Account deleted successfully.");
      navigate("/", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete account.";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl pb-5">
        <div
          className="surface-hero noise-overlay relative mb-8 overflow-hidden rounded-[2.5rem] border border-luxe px-6 py-8 opacity-0 animate-fade-up md:px-10 md:py-10"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,hsl(164_45%_78%/0.18),transparent_48%)]" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-primary/10 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-primary">
              Account settings
            </div>
            <h1 className="max-w-2xl font-display text-4xl leading-[0.98] text-gradient md:text-6xl">
              Manage your identity with a little more control.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              Update your username, email, password, and account access from one clear place.
            </p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={handleProfileSubmit}
            className="surface-glass rounded-[2rem] border border-luxe p-6"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserRound className="h-4 w-4 text-primary" />
                  Profile
                </div>
                <p className="text-sm leading-7 text-muted-foreground">
                  Keep your display name and sign-in email current across the workspace.
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-white/70 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Live account
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="accountName">Username</Label>
                <Input
                  id="accountName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountEmail">Email</Label>
                <Input
                  id="accountEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-white/45 px-4 py-3 text-sm text-muted-foreground">
              <span>Your session updates automatically after a successful profile change.</span>
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
              </Button>
            </div>
          </form>

          <div className="surface-glass rounded-[2rem] border border-luxe p-6">
            <div className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Signed in as
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-white/55 p-5">
              <div className="text-lg font-semibold">{user?.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{user?.email}</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Use the controls here to keep your login details accurate and your account secure.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={handlePasswordSubmit}
            className="surface-glass rounded-[2rem] border border-luxe p-6"
          >
            <div className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Shield className="h-4 w-4 text-primary" />
              Change password
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </div>
          </form>

          <form
            onSubmit={handleDeleteAccount}
            className="surface-glass rounded-[2rem] border border-destructive/25 p-6"
          >
            <div className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Delete account
            </div>
            <p className="mb-4 text-sm leading-7 text-muted-foreground">
              This permanently removes your sign-in access and clears your saved account record.
            </p>
            <div className="space-y-2">
              <Label htmlFor="deletePassword">Confirm with password</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              className="mt-5 w-full"
              disabled={deleteLoading}
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete account"}
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
