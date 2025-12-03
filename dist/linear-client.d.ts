import { Issue } from "@linear/sdk";
import { ParsedIssue, CreateIssuesResult, GitlinConfig, CommentData } from "./types.js";
/**
 * Linear API client for creating issues
 */
export declare class LinearClient {
    private client;
    private config;
    private labelCache?;
    constructor(config: GitlinConfig);
    /**
     * Find existing issues created from a specific PR URL
     */
    findIssuesByPRUrl(prUrl: string): Promise<Issue[]>;
    /**
     * Create multiple Linear issues from parsed data
     */
    createIssues(issues: ParsedIssue[], prUrl?: string, comments?: CommentData[]): Promise<CreateIssuesResult>;
    /**
     * Get available Linear labels (cached)
     */
    getAvailableLabels(): Promise<string[]>;
    /**
     * Refresh label cache from Linear API
     */
    private refreshLabelCache;
    /**
     * Apply label mapping from config
     */
    private applyLabelMapping;
    /**
     * Create a single Linear issue
     */
    private createIssue;
    /**
     * Verify API connection and team access
     */
    verify(): Promise<boolean>;
}
//# sourceMappingURL=linear-client.d.ts.map