// API service layer — swap BASE_URL to your Node.js backend when ready
const BASE_URL = import.meta.env.VITE_API_URL || "";

type CVFeedback = {
  category: string;
  score: number;
  maxScore: number;
  comment: string;
  suggestions: string[];
};

type CVAnalysisResult = {
  overallScore: number;
  feedback: CVFeedback[];
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

export async function analyzeCV(file: File): Promise<{
  overallScore: number;
  feedback: Array<{
    category: string;
    score: number;
    maxScore: number;
    comment: string;
    suggestions: string[];
  }>;
}> {
  if (BASE_URL) {
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

    const formData = new FormData();
    formData.append("cv", file);
    const res = await fetch(`${BASE_URL}/api/cv/analyze`, {
      method: "POST",
      body: formData,
    });
    return res.json();
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
        comment: "Good overall layout, but section headings could be more distinct. Consider using consistent formatting for dates.",
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
        comment: "Experience descriptions are too task-focused. Lead with measurable achievements instead of responsibilities.",
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
        comment: "Good keyword coverage for target role. Missing some emerging technologies that recruiters filter for.",
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
        comment: "Professional but generic. Needs a stronger personal brand and clearer career narrative.",
        suggestions: [
          "Add a concise professional summary (2-3 lines)",
          "Tailor content to your target role",
          "Remove outdated or irrelevant experience",
        ],
      },
    ],
  };
}

export async function requestCVUploadUrl(file: File): Promise<PresignedUploadPayload | null> {
  if (!BASE_URL) return null;

  for (const endpoint of PRESIGN_ENDPOINTS) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
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

      const uploadUrl: string | undefined = data.uploadUrl || data.presignedUrl || data.url;
      const fileUrl: string | undefined = data.fileUrl || data.publicUrl || data.objectUrl;

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
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const method = config.method || "PUT";

    xhr.open(method, config.uploadUrl, true);

    if (method === "PUT") {
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
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
}): Promise<CVAnalysisResult | null> {
  if (!BASE_URL) return null;

  const endpoints = ["/api/cv/analyze-upload", "/api/cv/analyze-by-url"];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
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
  type: "voice" | "technical"
): Promise<
  Array<{
    id: string;
    question: string;
    category: string;
    difficulty: "easy" | "medium" | "hard";
    expectedPoints: string[];
  }>
> {
  if (BASE_URL) {
    const res = await fetch(
      `${BASE_URL}/api/interview/questions?role=${encodeURIComponent(jobRole)}&type=${type}`
    );
    return res.json();
  }

  await new Promise((r) => setTimeout(r, 1000));

  if (type === "voice") {
    return [
      {
        id: "v1",
        question: "Tell me about yourself and why you're interested in this role.",
        category: "Introduction",
        difficulty: "easy",
        expectedPoints: [
          "Brief professional background",
          "Relevant skills",
          "Motivation for the role",
        ],
      },
      {
        id: "v2",
        question: "Describe a challenging project you worked on. What was your role and what was the outcome?",
        category: "Experience",
        difficulty: "medium",
        expectedPoints: [
          "Clear problem statement",
          "Your specific contribution",
          "Measurable outcome",
          "Lessons learned",
        ],
      },
      {
        id: "v3",
        question: "How do you handle disagreements with team members about technical decisions?",
        category: "Behavioral",
        difficulty: "medium",
        expectedPoints: [
          "Active listening",
          "Data-driven approach",
          "Compromise and collaboration",
          "Specific example",
        ],
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
      },
    ];
  }

  return [
    {
      id: "t1",
      question: "What is the difference between 'let', 'const', and 'var' in JavaScript?",
      category: "JavaScript Fundamentals",
      difficulty: "easy",
      expectedPoints: [
        "Block scoping vs function scoping",
        "Hoisting behavior",
        "Reassignment rules for const",
      ],
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
    },
    {
      id: "t3",
      question: "What are React hooks? Explain useState and useEffect with examples.",
      category: "React",
      difficulty: "medium",
      expectedPoints: [
        "State management without classes",
        "Side effect handling",
        "Dependency array behavior",
        "Cleanup functions",
      ],
    },
    {
      id: "t4",
      question: "How would you optimize a React application that is rendering slowly?",
      category: "Performance",
      difficulty: "hard",
      expectedPoints: [
        "React.memo / useMemo / useCallback",
        "Code splitting and lazy loading",
        "Virtual scrolling for large lists",
        "Profiler usage",
      ],
    },
    {
      id: "t5",
      question: "Design a REST API for a todo application. What endpoints would you create?",
      category: "System Design",
      difficulty: "medium",
      expectedPoints: [
        "CRUD operations mapping to HTTP methods",
        "Proper status codes",
        "Resource naming conventions",
        "Authentication considerations",
      ],
    },
  ];
}

export async function evaluateAnswer(
  questionId: string,
  answer: string,
  expectedPoints: string[]
): Promise<{
  score: number;
  maxScore: number;
  feedback: string;
  matchedPoints: string[];
  missedPoints: string[];
}> {
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/api/interview/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, answer, expectedPoints }),
    });
    return res.json();
  }

  await new Promise((r) => setTimeout(r, 1500));
  const matched = expectedPoints.slice(0, Math.ceil(expectedPoints.length * 0.6));
  const missed = expectedPoints.slice(Math.ceil(expectedPoints.length * 0.6));
  return {
    score: Math.round((matched.length / expectedPoints.length) * 20),
    maxScore: 20,
    feedback: "Good answer with solid fundamentals. Try to include more specific examples and quantify impact where possible.",
    matchedPoints: matched,
    missedPoints: missed,
  };
}
