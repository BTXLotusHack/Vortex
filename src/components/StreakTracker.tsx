import { useInterviewStore, type ModuleType } from "@/stores/interviewStore";
import { Flame, Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleStreak {
  module: ModuleType;
  label: string;
  streak: number;
  direction: "up" | "down" | "neutral";
  latestPct: number;
}

const moduleLabels: Record<ModuleType, string> = {
  "cv-screening": "CV",
  "voice-interview": "Voice",
  "technical-interview": "Technical",
};

function computeStreak(
  attempts: { overallScore: number; maxScore: number }[],
): { streak: number; direction: "up" | "down" | "neutral" } {
  if (attempts.length < 2) return { streak: 0, direction: "neutral" };

  let streak = 0;
  let direction: "up" | "down" | "neutral" = "neutral";

  for (let i = 0; i < attempts.length - 1; i++) {
    const currentPct = attempts[i].maxScore > 0 ? attempts[i].overallScore / attempts[i].maxScore : 0;
    const prevPct = attempts[i + 1].maxScore > 0 ? attempts[i + 1].overallScore / attempts[i + 1].maxScore : 0;

    const improved = currentPct > prevPct;
    const declined = currentPct < prevPct;

    if (i === 0) {
      if (improved) direction = "up";
      else if (declined) direction = "down";
      else direction = "neutral";
    }

    if (direction === "up" && improved) streak++;
    else if (direction === "down" && declined) streak++;
    else break;
  }

  return { streak, direction };
}

function getStreakMessage(bestStreak: ModuleStreak | null, totalImproving: number): string {
  if (!bestStreak || bestStreak.streak === 0) {
    return "Complete more attempts to start tracking your improvement streaks.";
  }

  if (bestStreak.direction === "down") {
    return `${bestStreak.label} scores have dipped ${bestStreak.streak} time${bestStreak.streak > 1 ? "s" : ""} in a row. Review the feedback and try a focused practice round.`;
  }

  if (bestStreak.streak >= 3) {
    return `Impressive! ${bestStreak.streak}-attempt improvement streak in ${bestStreak.label}. You're on a roll — keep the momentum going.`;
  }

  if (totalImproving >= 2) {
    return "Multiple modules are trending up. Consistent practice is paying off.";
  }

  return `${bestStreak.label} is improving — ${bestStreak.streak} consecutive score increase${bestStreak.streak > 1 ? "s" : ""}.`;
}

export function StreakTracker() {
  const { getModuleAttempts, getLatestAttempt } = useInterviewStore();

  const modules: ModuleType[] = ["cv-screening", "voice-interview", "technical-interview"];
  const streaks: ModuleStreak[] = modules
    .map((module) => {
      const attempts = getModuleAttempts(module);
      const latest = getLatestAttempt(module);
      const { streak, direction } = computeStreak(attempts);
      return {
        module,
        label: moduleLabels[module],
        streak,
        direction,
        latestPct: latest && latest.maxScore > 0 ? latest.overallScore / latest.maxScore : 0,
      };
    })
    .filter((s) => s.streak > 0);

  if (streaks.length === 0) return null;

  const bestStreak = [...streaks].sort((a, b) => b.streak - a.streak)[0] ?? null;
  const totalImproving = streaks.filter((s) => s.direction === "up").length;
  const message = getStreakMessage(bestStreak, totalImproving);

  return (
    <div className="surface-glass rounded-[1.75rem] border border-luxe px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-score-medium" />
          <h3 className="text-sm font-semibold">Performance Streaks</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Momentum
        </span>
      </div>

      <div className="flex gap-4 mb-3">
        {streaks.map((s) => (
          <div
            key={s.module}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2",
              s.direction === "up"
                ? "border-score-high/30 bg-score-high/5"
                : s.direction === "down"
                  ? "border-score-low/30 bg-score-low/5"
                  : "border-border",
            )}
          >
            {s.direction === "up" ? (
              <TrendingUp className="h-4 w-4 text-score-high" />
            ) : s.direction === "down" ? (
              <TrendingUp className="h-4 w-4 rotate-180 text-score-low" />
            ) : null}
            <div>
              <span className="text-xs font-medium">{s.label}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">
                {s.streak}× {s.direction === "up" ? "up" : s.direction === "down" ? "down" : ""}
              </span>
            </div>
            {s.streak >= 3 && s.direction === "up" && (
              <Trophy className="h-3.5 w-3.5 text-score-medium" />
            )}
          </div>
        ))}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">{message}</p>
    </div>
  );
}
