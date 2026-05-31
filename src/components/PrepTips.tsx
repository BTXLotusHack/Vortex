import { useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleType } from "@/stores/interviewStore";

interface PrepTip {
  title: string;
  body: string;
}

const tipsByModule: Record<ModuleType, PrepTip[]> = {
  "cv-screening": [
    {
      title: "Tailor to the JD",
      body: "Mirror keywords and phrases from the job description in your CV. ATS systems and reviewers look for direct alignment between your experience and the role requirements.",
    },
    {
      title: "Quantify achievements",
      body: "Replace vague statements like 'improved performance' with measurable results: 'Reduced API response time by 40%, cutting p95 latency from 850ms to 510ms.'",
    },
    {
      title: "Keep it concise",
      body: "Aim for 1-2 pages. Prioritize your most relevant and recent experience. Remove outdated skills or roles that don't support your application.",
    },
    {
      title: "Use a clean format",
      body: "Stick to standard section headings (Experience, Education, Skills). Avoid tables, images, or complex layouts that confuse ATS parsers.",
    },
  ],
  "voice-interview": [
    {
      title: "Use the STAR method",
      body: "Structure behavioral answers as: Situation (context), Task (your responsibility), Action (what you did), Result (measurable outcome). This keeps answers focused and compelling.",
    },
    {
      title: "Speak naturally",
      body: "Avoid reading from scripts. Practice your key stories enough that you can tell them conversationally. Pause to think — silence is better than filler words.",
    },
    {
      title: "Prepare 3-5 stories",
      body: "Have versatile stories ready that demonstrate leadership, problem-solving, collaboration, and handling failure. Adapt them to different question angles.",
    },
    {
      title: "Show genuine interest",
      body: "Research the company and role beforehand. Reference specific details about the team, product, or mission when answering 'Why this company?' questions.",
    },
  ],
  "technical-interview": [
    {
      title: "Think out loud",
      body: "Explain your reasoning as you work through problems. Interviewers want to see your thought process, not just the final answer. State your assumptions explicitly.",
    },
    {
      title: "Clarify before coding",
      body: "Ask about edge cases, input constraints, and expected output format before writing code. This shows thoroughness and prevents wasted effort on wrong assumptions.",
    },
    {
      title: "Start with brute force",
      body: "Describe the simplest solution first, analyze its complexity, then optimize. This demonstrates problem-solving progression and ensures you have a working answer.",
    },
    {
      title: "Test your solution",
      body: "Walk through your code with a sample input. Check boundary conditions (empty input, single element, large input). Fix bugs before declaring you're done.",
    },
  ],
};

export function PrepTips({ module }: { module: ModuleType }) {
  const [expanded, setExpanded] = useState(false);
  const tips = tipsByModule[module];

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-score-medium" />
          <span className="text-sm font-medium">Preparation Tips</span>
          <span className="text-xs text-muted-foreground">({tips.length} tips)</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-4 py-3 space-y-3">
          {tips.map((tip, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={cn(
                  "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  "bg-primary/10 text-primary",
                )}
              >
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium">{tip.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {tip.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
