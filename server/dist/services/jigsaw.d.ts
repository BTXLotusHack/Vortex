type JigsawInput = {
    file: {
        buffer: Buffer;
        mimeType: string;
        fileName: string;
    };
} | {
    fileUrl: string;
};
export declare function extractCvText(input: JigsawInput): Promise<string>;
export {};
//# sourceMappingURL=jigsaw.d.ts.map