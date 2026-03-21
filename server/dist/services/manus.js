const MANUS_BASE_URL = process.env.MANUS_API_URL || "";
function normalizeTechStack(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw)) {
        return raw
            .map((value) => String(value).trim())
            .filter(Boolean)
            .filter((value, index, arr) => arr.indexOf(value) === index);
    }
    if (typeof raw === "string") {
        return raw
            .split(/[,\n|]/g)
            .map((value) => value.trim())
            .filter(Boolean)
            .filter((value, index, arr) => arr.indexOf(value) === index);
    }
    return [];
}
function extractJobPayload(payload) {
    const source = payload?.data || payload;
    const jobText = source?.jobText ||
        source?.job_text ||
        source?.content ||
        source?.text ||
        source?.markdown ||
        "";
    const techStack = normalizeTechStack(source?.techStack || source?.tech_stack || source?.skills || source?.stack);
    return {
        jobText: String(jobText || "").trim(),
        techStack,
    };
}
export async function scrapeLinkedinJob(jobUrl) {
    if (!MANUS_BASE_URL) {
        throw new Error("MANUS_API_URL is not configured.");
    }
    const apiKey = process.env.MANUS_API_KEY;
    const response = await fetch(`${MANUS_BASE_URL.replace(/\/$/, "")}/scrape`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
            url: jobUrl,
            provider: "linkedin",
            extract: ["job_text", "tech_stack"],
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Manus scrape failed: ${err}`);
    }
    const payload = await response.json();
    const result = extractJobPayload(payload);
    if (!result.jobText && result.techStack.length === 0) {
        throw new Error("Manus returned an empty payload.");
    }
    return result;
}
//# sourceMappingURL=manus.js.map