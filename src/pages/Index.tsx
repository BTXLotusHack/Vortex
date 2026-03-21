import {
  ArrowRight,
  BarChart3,
  Code2,
  FileText,
  Mic,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

const featureCards = [
  {
    title: "CV Diagnostics",
    description: "Compare CV quality against the role and extract signals.",
    icon: FileText,
    className: "md:col-span-2",
  },
  {
    title: "Voice Rehearsal",
    description: "Realistic AI interview agents.",
    icon: Mic,
    className: "md:col-span-1",
  },
  {
    title: "Technical Rounds",
    description: "Role-matched prompts with deep reasoning.",
    icon: Code2,
    className: "md:col-span-3",
  },
];

export default function Index() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[hsl(165_26%_10%)] text-slate-50 selection:bg-[hsl(42_52%_78%)] selection:text-[hsl(165_25%_12%)]">
      {/* Background stays full-scale for depth */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(160_55%_34%/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:30px_30px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6">
        {/* Navigation - KEEP 100% SCALE */}
        <header className="flex items-center justify-between py-8">
          <div className="flex items-center gap-2.5 group cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(42_52%_78%)] transition-transform group-hover:rotate-12">
              <span className="font-display text-xl font-bold text-[hsl(165_25%_12%)]">
                V
              </span>
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-white/90">
              VORTEX
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <Link
                to="/dashboard"
                className="group flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[hsl(165_25%_12%)] transition-all hover:bg-[hsl(42_52%_78%)]"
              >
                Dashboard{" "}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <div className="flex items-center gap-6">
                <Link
                  to="/login"
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-white/10 border border-white/20 px-5 py-2 text-sm font-semibold backdrop-blur-sm hover:bg-white/20 transition-all"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Scaled Down Content (The 70% Vibe) */}
        <main className="pb-16 pt-8 lg:pt-12">
          <div className="flex flex-col items-center text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(42_52%_78%/0.2)] bg-[hsl(42_52%_78%/0.05)] px-3 py-1 text-[10px] font-medium tracking-widest text-[hsl(42_52%_78%)] uppercase">
              <Sparkles className="h-3 w-3" />
              AI Interview Intelligence
            </div>

            <h1 className="mt-6 max-w-2xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
              From CV to tech round in{" "}
              <span className="text-[hsl(42_52%_78%)]">
                one clean workflow.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-sm leading-relaxed text-slate-400 md:text-base">
              Vortex streamlines your hiring pipeline. Score CVs, conduct voice
              AI interviews, and generate deep technical assessments.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/register"
                className="h-10 flex items-center gap-2 rounded-full bg-[hsl(42_52%_78%)] px-6 text-xs font-bold text-[hsl(165_25%_12%)] transition-transform hover:scale-105 active:scale-95"
              >
                Start for free
              </Link>
              <button className="h-10 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 text-xs font-semibold backdrop-blur-md hover:bg-white/10 transition-colors">
                Watch Demo <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Features Bento Grid - More compact */}
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3 max-w-4xl mx-auto">
            {featureCards.map((card) => (
              <div
                key={card.title}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20 hover:bg-white/[0.05] ${card.className}`}
              >
                <div className="relative z-10">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(42_52%_78%/0.1)] text-[hsl(42_52%_78%)]">
                    <card.icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-white">
                    {card.title}
                  </h3>
                  <p className="mt-2 max-w-[200px] text-xs leading-relaxed text-slate-500 group-hover:text-slate-400 transition-colors">
                    {card.description}
                  </p>
                </div>

                {card.className.includes("md:col-span-2") && (
                  <div className="absolute bottom-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BarChart3 className="h-20 w-20 text-[hsl(42_52%_78%)]" />
                  </div>
                )}
              </div>
            ))}
          </section>
        </main>

        <footer className="mt-12 border-t border-white/5 py-8 text-center">
          <p className="text-[10px] tracking-[0.2em] text-slate-600 uppercase">
            © 2026 VORTEX INTERVIEW OS
          </p>
        </footer>
      </div>
    </div>
  );
}
