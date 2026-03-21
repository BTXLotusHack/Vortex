declare global {
  interface Window {
    __VORTEX_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function normalizeApiBaseUrl(value?: string | null) {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, "").replace(/\/+$/, "");
  return normalized || "";
}

function isLocalHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

function shouldIgnoreConfiguredApiUrl(value: string) {
  if (!import.meta.env.PROD || typeof window === "undefined") {
    return false;
  }

  try {
    const configuredUrl = new URL(value);
    return isLocalHostname(configuredUrl.hostname) && !isLocalHostname(window.location.hostname);
  } catch {
    return false;
  }
}

function resolveApiBaseUrl() {
  const runtimeApiUrl =
    typeof window === "undefined"
      ? ""
      : normalizeApiBaseUrl(window.__VORTEX_CONFIG__?.apiUrl);
  const configuredApiUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

  for (const candidate of [runtimeApiUrl, configuredApiUrl]) {
    if (!candidate || shouldIgnoreConfiguredApiUrl(candidate)) {
      continue;
    }

    return candidate;
  }

  return "";
}

const BASE_URL = resolveApiBaseUrl();

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
};

type AuthResponse = {
  user: AuthUser | null;
};

type SignupOtpResponse = {
  email: string;
  message: string;
};

type SuccessResponse = {
  success: boolean;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return BASE_URL ? `${BASE_URL}${normalizedPath}` : normalizedPath;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  try {
    return await fetch(apiUrl(path), {
      credentials: "include",
      ...init,
    });
  } catch {
    throw new ApiError(
      import.meta.env.PROD
        ? "Unable to reach the API. Check the deployed API URL and CORS settings."
        : "Unable to reach the API. Start the backend or set VITE_API_URL.",
      0,
    );
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson
    ? ((await response.json()) as T | ApiErrorPayload)
    : null;

  if (!response.ok) {
    const message =
      (payload as ApiErrorPayload | null)?.error ||
      (payload as ApiErrorPayload | null)?.message ||
      "Request failed.";
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

type InterviewQuestionPayload = {
  id: string;
  question: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  expectedPoints: string[];
  requiresCoding?: boolean;
};

type CVFeedback = {
  category: string;
  score: number;
  maxScore: number;
  comment: string;
  suggestions: string[];
};

export type CandidateProfilePayload = {
  summary: string;
  strengths: string[];
  risks: string[];
  likelySkills: string[];
  seniority: string;
  jobFitScore?: number;
  jobFitVerdict?: "strong-fit" | "partial-fit" | "weak-fit";
  jobFitSummary?: string;
};

export type CVAnalysisResult = {
  overallScore: number;
  feedback: CVFeedback[];
  insights?: {
    strengths: string[];
    risks: string[];
    nextSteps: string[];
  };
  candidateProfile?: CandidateProfilePayload;
};

export type PresignedUploadPayload = {
  uploadUrl: string;
  fileUrl: string;
  method?: "PUT" | "POST";
  fields?: Record<string, string>;
  headers?: Record<string, string>;
  key?: string;
};

const PRESIGN_ENDPOINTS = [
  "/api/cv/presigned-url",
  "/api/cv/presign-upload",
  "/api/cv/upload-url",
];

// For now, all analysis is done client-side with mock delays.
// When your Node.js backend is running, these will call real endpoints.

export async function analyzeCV(
  file: File,
  options?: { jobRole?: string; jobDescription?: string },
): Promise<CVAnalysisResult> {
  try {
    const presigned = await requestCVUploadUrl(file);
    if (presigned) {
      await uploadCVToPresignedUrl(file, presigned);
      const uploaded = await analyzeUploadedCV({
        fileUrl: presigned.fileUrl,
        key: presigned.key,
        fileName: file.name,
      });
      if (uploaded) return uploaded;
    }
  } catch {
    // Fallback to direct upload below when presigned flow is unavailable.
  }

  try {
    const formData = new FormData();
    formData.append("cv", file);
    if (options?.jobRole) {
      formData.append("jobRole", options.jobRole);
    }
    if (options?.jobDescription) {
      formData.append("jobDescription", options.jobDescription);
    }
    const res = await fetch(apiUrl("/api/cv/analyze"), {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      return (await res.json()) as CVAnalysisResult;
    }
  } catch {
    // Fall back to mock analysis below when backend is unavailable.
  }

  // Mock analysis
  await new Promise((r) => setTimeout(r, 2500));
  return {
    overallScore: 72,
    feedback: [
      {
        category: "Formatting & Structure",
        score: 18,
        maxScore: 25,
        comment:
          "Good overall layout, but section headings could be more distinct. Consider using consistent formatting for dates.",
        suggestions: [
          "Use bold section headers with clear dividers",
          "Align dates consistently to the right margin",
          "Ensure consistent font sizes throughout",
        ],
      },
      {
        category: "Content & Impact",
        score: 16,
        maxScore: 25,
        comment:
          "Experience descriptions are too task-focused. Lead with measurable achievements instead of responsibilities.",
        suggestions: [
          "Start bullets with action verbs (Led, Increased, Built)",
          "Add quantifiable metrics (%, $, time saved)",
          "Focus on outcomes, not just duties",
        ],
      },
      {
        category: "Keywords & ATS",
        score: 20,
        maxScore: 25,
        comment:
          "Good keyword coverage for target role. Missing some emerging technologies that recruiters filter for.",
        suggestions: [
          "Add relevant technical skills in a dedicated section",
          "Mirror language from job descriptions you're targeting",
          "Include industry-standard certifications",
        ],
      },
      {
        category: "Overall Impression",
        score: 18,
        maxScore: 25,
        comment:
          "Professional but generic. Needs a stronger personal brand and clearer career narrative.",
        suggestions: [
          "Add a concise professional summary (2-3 lines)",
          "Tailor content to your target role",
          "Remove outdated or irrelevant experience",
        ],
      },
    ],
    insights: {
      strengths: ["Clear section ordering", "Good baseline keyword coverage"],
      risks: [
        "Impact statements are still generic",
        "Summary is not role-targeted",
      ],
      nextSteps: [
        "Quantify your top achievements",
        "Tailor summary to your target role",
        "Add missing tools from target job descriptions",
      ],
    },
    candidateProfile: {
      summary:
        "Product-minded frontend engineer with solid delivery experience, decent ATS alignment, and the biggest upside in sharper impact framing.",
      strengths: [
        "Frontend foundations",
        "Structured communication",
        "Baseline tool coverage",
      ],
      risks: [
        "Limited quantified outcomes",
        "Narrative may feel generic without tailoring",
      ],
      likelySkills: [
        "React",
        "TypeScript",
        "JavaScript",
        "UI collaboration",
        "API integration",
      ],
      seniority: "Mid-level",
      jobFitScore: 74,
      jobFitVerdict: "partial-fit",
      jobFitSummary:
        "The candidate aligns with the core frontend scope, but the JD fit would improve with clearer evidence of measurable impact and closer keyword overlap with the target role.",
    },
  };
}

export async function requestCVUploadUrl(
  file: File,
): Promise<PresignedUploadPayload | null> {
  for (const endpoint of PRESIGN_ENDPOINTS) {
    try {
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });

      if (!response.ok) continue;
      const data = await response.json();

      const uploadUrl: string | undefined =
        data.uploadUrl || data.presignedUrl || data.url;
      const fileUrl: string | undefined =
        data.fileUrl || data.publicUrl || data.objectUrl;

      if (!uploadUrl || !fileUrl) continue;

      return {
        uploadUrl,
        fileUrl,
        method: (data.method || "PUT") as "PUT" | "POST",
        fields: data.fields,
        headers: data.headers,
        key: data.key,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function uploadCVToPresignedUrl(
  file: File,
  config: PresignedUploadPayload,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const method = config.method || "PUT";

    xhr.open(method, config.uploadUrl, true);

    if (method === "PUT") {
      xhr.setRequestHeader(
        "Content-Type",
        file.type || "application/octet-stream",
      );
      Object.entries(config.headers || {}).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () => reject(new Error("Failed to upload CV to storage."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    if (method === "POST") {
      const formData = new FormData();
      Object.entries(config.fields || {}).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append("file", file);
      xhr.send(formData);
      return;
    }

    xhr.send(file);
  });
}

export async function analyzeUploadedCV(payload: {
  fileUrl: string;
  key?: string;
  fileName?: string;
  jobRole?: string;
  jobDescription?: string;
}): Promise<CVAnalysisResult | null> {
  const endpoints = ["/api/cv/analyze-upload", "/api/cv/analyze-by-url"];
  for (const endpoint of endpoints) {
    try {
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) continue;
      return (await response.json()) as CVAnalysisResult;
    } catch {
      continue;
    }
  }

  return null;
}

export async function getInterviewQuestions(
  jobRole: string,
  type: "voice" | "technical",
  count = 5,
  options?: {
    questionBrief?: string;
  },
): Promise<InterviewQuestionPayload[]> {
  try {
    const res = await apiFetch("/api/interview/questions", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: jobRole,
        type,
        count,
        questionBrief: options?.questionBrief,
      }),
    });

    if (res.ok) {
      return res.json();
    }

    if (type === "technical") {
      const data = await res.json().catch(() => null);
      const message = data?.error || "Technical question generation failed.";
      throw new Error(message);
    }
  } catch (error) {
    if (type === "technical" && error instanceof Error) {
      console.warn(
        "Technical question generation fell back to local questions:",
        error.message,
      );
    }
    // Fall back to local mock below when backend is unavailable.
  }

  await new Promise((r) => setTimeout(r, 1000));

  if (type === "voice") {
    const mockVoice: InterviewQuestionPayload[] = [
      {
        id: "v1",
        question:
          "Tell me about yourself and why you're interested in this role.",
        category: "Introduction",
        difficulty: "easy",
        expectedPoints: [
          "Brief professional background",
          "Relevant skills",
          "Motivation for the role",
        ],
        requiresCoding: false,
      },
      {
        id: "v2",
        question:
          "Describe a challenging project you worked on. What was your role and what was the outcome?",
        category: "Experience",
        difficulty: "medium",
        expectedPoints: [
          "Clear problem statement",
          "Your specific contribution",
          "Measurable outcome",
          "Lessons learned",
        ],
        requiresCoding: false,
      },
      {
        id: "v3",
        question:
          "How do you handle disagreements with team members about technical decisions?",
        category: "Behavioral",
        difficulty: "medium",
        expectedPoints: [
          "Active listening",
          "Data-driven approach",
          "Compromise and collaboration",
          "Specific example",
        ],
        requiresCoding: false,
      },
      {
        id: "v4",
        question: "Where do you see yourself in three years?",
        category: "Career Goals",
        difficulty: "easy",
        expectedPoints: [
          "Growth trajectory",
          "Alignment with company",
          "Continuous learning",
        ],
        requiresCoding: false,
      },
      {
        id: "v5",
        question: "Do you have any questions for us?",
        category: "Engagement",
        difficulty: "easy",
        expectedPoints: [
          "Thoughtful questions about team/culture",
          "Interest in growth opportunities",
          "Genuine curiosity",
        ],
        requiresCoding: false,
      },
    ];
    return mockVoice.slice(0, count);
  }

  const mockTechnical: InterviewQuestionPayload[] = [
    {
      id: "t1",
      question:
        "What is the difference between 'let', 'const', and 'var' in JavaScript?",
      category: "JavaScript Fundamentals",
      difficulty: "easy",
      expectedPoints: [
        "Block scoping vs function scoping",
        "Hoisting behavior",
        "Reassignment rules for const",
      ],
      requiresCoding: false,
    },
    {
      id: "t2",
      question: "Explain the concept of closures and give a practical example.",
      category: "JavaScript Fundamentals",
      difficulty: "medium",
      expectedPoints: [
        "Function retaining access to outer scope",
        "Lexical environment",
        "Practical use case (e.g., data privacy, event handlers)",
      ],
      requiresCoding: false,
    },
    {
      id: "t3",
      question:
        "What are React hooks? Explain useState and useEffect with examples.",
      category: "React",
      difficulty: "medium",
      expectedPoints: [
        "State management without classes",
        "Side effect handling",
        "Dependency array behavior",
        "Cleanup functions",
      ],
      requiresCoding: false,
    },
    {
      id: "t4",
      question:
        "How would you optimize a React application that is rendering slowly?",
      category: "Performance",
      difficulty: "hard",
      expectedPoints: [
        "React.memo / useMemo / useCallback",
        "Code splitting and lazy loading",
        "Virtual scrolling for large lists",
        "Profiler usage",
      ],
      requiresCoding: false,
    },
    {
      id: "t5",
      question:
        "Design a REST API for a todo application. What endpoints would you create?",
      category: "System Design",
      difficulty: "medium",
      expectedPoints: [
        "CRUD operations mapping to HTTP methods",
        "Proper status codes",
        "Resource naming conventions",
        "Authentication considerations",
      ],
      requiresCoding: true,
    },
  ];
  return mockTechnical.slice(0, count);
}

export async function evaluateAnswer(
  questionId: string,
  answer: string,
  expectedPoints: string[],
  options?: {
    type?: "voice" | "technical";
    question?: string;
    difficulty?: "easy" | "medium" | "hard";
    requiresCoding?: boolean;
  },
): Promise<{
  score: number;
  maxScore: number;
  feedback: string;
  matchedPoints: string[];
  missedPoints: string[];
  reasoning?: string;
  processInsight?: {
    strengths: string[];
    risks: string[];
    nextSteps: string[];
  };
}> {
  try {
    const res = await apiFetch("/api/interview/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        answer,
        expectedPoints,
        type: options?.type,
        question: options?.question,
        difficulty: options?.difficulty,
        requiresCoding: options?.requiresCoding,
      }),
    });

    if (res.ok) {
      return res.json();
    }
  } catch {
    // Fall back to local mock below when backend is unavailable.
  }

  await new Promise((r) => setTimeout(r, 1500));
  const matched = expectedPoints.slice(
    0,
    Math.ceil(expectedPoints.length * 0.6),
  );
  const missed = expectedPoints.slice(Math.ceil(expectedPoints.length * 0.6));
  return {
    score: Math.round((matched.length / expectedPoints.length) * 20),
    maxScore: 20,
    feedback:
      "Good answer with solid fundamentals. Try to include more specific examples and quantify impact where possible.",
    matchedPoints: matched,
    missedPoints: missed,
    reasoning: "Fallback scoring used.",
    processInsight: {
      strengths: matched.slice(0, 2),
      risks: missed.slice(0, 2),
      nextSteps: missed.slice(0, 2).map((item) => `Practice: ${item}`),
    },
  };
}

export async function evaluateVoiceTranscript(payload: {
  transcript: Array<{ role: "user" | "agent"; message: string }>;
  jobRole: string;
  jobDescription?: string;
  candidateProfile?: CandidateProfilePayload | null;
}): Promise<{
  overallScore: number;
  maxScore: number;
  feedback: Array<{
    category: string;
    score: number;
    maxScore: number;
    comment: string;
    suggestions: string[];
  }>;
  summary: {
    gainedPoints: string[];
    lostPoints: string[];
  };
}> {
  try {
    const res = await apiFetch("/api/interview/evaluate-voice-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return res.json();
    }
  } catch {
    // Fall back to local mock below when backend is unavailable.
  }

  await new Promise((r) => setTimeout(r, 1200));
  return {
    overallScore: 76,
    maxScore: 100,
    feedback: [
      {
        category: "Communication Clarity",
        score: 21,
        maxScore: 25,
        comment:
          "Answers were generally clear and understandable, though some responses could have been more structured and concise.",
        suggestions: [
          "Use a tighter answer structure",
          "Lead with the outcome before details",
        ],
      },
      {
        category: "Behavioral Depth",
        score: 18,
        maxScore: 25,
        comment:
          "You gave relevant examples, but some did not fully explain the reasoning, trade-offs, or final impact.",
        suggestions: [
          "Explain your decisions more explicitly",
          "Add the result and what you learned",
        ],
      },
      {
        category: "Role Relevance",
        score: 20,
        maxScore: 25,
        comment:
          "Most of the discussion aligned well with the role, but some examples could have been tied back to the JD more directly.",
        suggestions: [
          "Connect examples to the role requirements",
          "Name the skill being demonstrated",
        ],
      },
      {
        category: "Professional Presence",
        score: 17,
        maxScore: 25,
        comment:
          "The overall tone was professional, but a few answers would benefit from more confidence and a stronger finish.",
        suggestions: [
          "Reduce filler phrases",
          "Close each answer with a clear takeaway",
        ],
      },
    ],
    summary: {
      gainedPoints: [
        "Clear spoken communication",
        "Relevant experience examples",
        "Professional tone",
      ],
      lostPoints: [
        "Sharper structure",
        "Stronger trade-off explanation",
        "More confident answer endings",
      ],
    },
  };
}

export async function signup(payload: {
  name: string;
  email: string;
  password: string;
}) {
  const response = await apiFetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<SignupOtpResponse>(response);
}

export async function verifySignupOtp(payload: { email: string; otp: string }) {
  const response = await apiFetch("/api/auth/signup/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<AuthResponse>(response);
}

export async function resendSignupOtp(payload: { email: string }) {
  const response = await apiFetch("/api/auth/signup/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<SignupOtpResponse>(response);
}

export async function login(payload: { email: string; password: string }) {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<AuthResponse>(response);
}

export async function logout() {
  const response = await apiFetch("/api/auth/logout", {
    method: "POST",
  });

  return parseApiResponse<{ success: boolean }>(response);
}

export async function getCurrentUser() {
  const response = await apiFetch("/api/auth/me", {
    method: "GET",
    cache: "no-store",
  });

  return parseApiResponse<AuthResponse>(response);
}

export async function forgotPassword(payload: { email: string }) {
  const response = await apiFetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<SignupOtpResponse>(response);
}

export async function resetPassword(payload: {
  email: string;
  otp: string;
  password: string;
}) {
  const response = await apiFetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<SuccessResponse>(response);
}

export async function updateProfile(payload: { name: string; email: string }) {
  const response = await apiFetch("/api/auth/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<AuthResponse>(response);
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  const response = await apiFetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<SuccessResponse>(response);
}

export async function deleteAccount(payload: { password: string }) {
  const response = await apiFetch("/api/auth/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<SuccessResponse>(response);
}
