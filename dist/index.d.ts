import { GitHubContext, GitlinConfig } from "./types.js";
/**
 * Main gitlin bot
 */
export declare class Gitlin {
    private config;
    private aiParser;
    private linearClient;
    private octokit;
    constructor(config: GitlinConfig);
    /**
     * Fetch all comments on a PR (both issue comments and review comments)
     * Filters out resolved review comment threads
     */
    private fetchAllPRComments;
    /**
     * Check if this PR has already been processed to avoid duplicates
     */
    private isPRProcessed;
    /**
     * Process a GitHub comment and create Linear issues
     */
    processComment(context: GitHubContext): Promise<string>;
    /**
     * Post a comment on GitHub PR or issue
     */
    postComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void>;
    /**
     * Verify all API connections
     */
    verify(): Promise<boolean>;
    /**
     * Add a reaction to a comment (for status updates)
     */
    addReaction(owner: string, repo: string, commentId: number, reaction: "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes"): Promise<void>;
}
/**
 * Main entry point for GitHub Action
 */
export declare function main(): Promise<void>;
//# sourceMappingURL=index.d.ts.map