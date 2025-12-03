import { GitHubContext, ParsedIssue } from "./types.js";
/**
 * Parse GitHub comment/PR content and extract actionable Linear issues using AI
 */
export declare class AIParser {
    private anthropic;
    constructor(apiKey: string);
    /**
     * Extract actionable issues from GitHub context
     */
    parseIssues(context: GitHubContext, availableLabels?: string[]): Promise<ParsedIssue[]>;
    /**
     * Build the prompt for Claude based on GitHub context
     */
    private buildPrompt;
}
//# sourceMappingURL=ai-parser.d.ts.map