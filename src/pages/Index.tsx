import { ArrowRight, BarChart3, Code2, FileText, Mic, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

const featureCards = [
  {
    title: "CV diagnostics",
    description: "Compare CV quality against the role and extract the candidate signals that matter.",
    icon: FileText,
  },
  {
    title: "Voice rehearsal",
    description: "Run realistic interview conversations with context-aware voice agents.",
    icon: Mic,
  },
  {
    title: "Technical rounds",
    description: "Generate role-matched technical prompts with practical reasoning and coding depth.",
    icon: Code2,
  },
];

export default function Index() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,hsl(165_26%_10%)_0%,hsl(168_24%_8%)_35%,hsl(44_35%_92%)_130%)] text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,hsl(43_50%_70%/0.16),transparent_18%),radial-gradient(circle_at_82%_14%,hsl(160_55%_34%/0.14),transparent_28%),radial-gradient(circle_at_74%_70%,hsl(42_46%_80%/0.12),transparent_24%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6 md:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-[1.8rem] border border-white/45 bg-white/12 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(42_52%_78%)]">
              <span className="font-display text-xl text-[hsl(165_25%_12%)]">V</span>
            </div>
            <div>
              <div className="font-display text-2xl text-white/95">VORTEX</div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-white/55">
                Interview OS
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Create account <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="flex flex-1 items-center py-10 lg:py-14">
          <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <section className="max-w-3xl">
              <div className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-[hsl(43_68%_78%)]">
                Calm, guided interview prep
              </div>
              <h1 className="font-display text-5xl leading-[0.96] text-white md:text-7xl">
                Turn CV screening, voice interviews, and technical rounds into one clean workflow.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/68 md:text-lg">
                VORTEX helps you start from the job description, score the CV, then move into conversational and technical assessment with smoother transitions and clearer signals.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={user ? "/dashboard" : "/register"}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" />
                  {user ? "Open workspace" : "Start with VORTEX"}
                </Link>
                <Link
                  to={user ? "/results" : "/login"}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/14"
                >
                  <BarChart3 className="h-4 w-4" />
                  {user ? "View progress" : "I already have an account"}
                </Link>
              </div>
            </section>

            <section className="grid gap-4">
              {featureCards.map((card, index) => (
                <div
                  key={card.title}
                  className="rounded-[1.8rem] border border-white/30 bg-white/14 p-5 backdrop-blur opacity-0 animate-fade-up"
                  style={{ animationDelay: `${index * 110}ms`, animationFillMode: "forwards" }}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(42_52%_78%)]/90 text-[hsl(165_25%_12%)]">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-2xl text-white">{card.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-white/65">
                    {card.description}
                  </p>
                </div>
              ))}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
