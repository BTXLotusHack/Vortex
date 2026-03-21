type EnsureUserInput = {
    id: string;
    email: string;
    name: string;
    avatar?: string;
};
type SessionArtifacts = {
    userId: string;
    sessionId: string;
    cvText?: string;
    jobText?: string;
    techStack?: string[];
    jobUrl?: string;
};
type ScoreInput = {
    userId: string;
    sessionId: string;
    question: string;
    answer: string;
};
export declare function ensureUser(user: EnsureUserInput): Promise<void>;
export declare function createSession(userId: string, jobUrl?: string): Promise<string>;
export declare function upsertSessionArtifacts(input: SessionArtifacts): Promise<void>;
export declare function indexSessionKnowledge(input: SessionArtifacts): Promise<void>;
export declare function scoreInterviewWithRag(input: ScoreInput): Promise<{
    overallScore: any;
    breakdown: any;
    rationale: any;
    improvements: any;
    retrievedContextCount: number;
}>;
export {};
//# sourceMappingURL=rag.d.ts.map