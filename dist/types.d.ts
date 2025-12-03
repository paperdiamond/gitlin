import { z } from "zod";
/**
 * Priority levels for Linear issues
 */
export declare enum Priority {
    Urgent = 0,
    High = 1,
    Medium = 2,
    Low = 3,
    NoPriority = 4
}
/**
 * Effort estimate for Linear issues
 */
export type Effort = "Small" | "Medium" | "Large";
/**
 * Parsed issue from AI
 */
export declare const ParsedIssueSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    priority: z.ZodEnum<["urgent", "high", "medium", "low"]>;
    effort: z.ZodOptional<z.ZodEnum<["small", "medium", "large"]>>;
    labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    assignee: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    priority: "urgent" | "high" | "medium" | "low";
    effort?: "medium" | "small" | "large" | undefined;
    labels?: string[] | undefined;
    assignee?: string | undefined;
    dependencies?: number[] | undefined;
}, {
    title: string;
    description: string;
    priority: "urgent" | "high" | "medium" | "low";
    effort?: "medium" | "small" | "large" | undefined;
    labels?: string[] | undefined;
    assignee?: string | undefined;
    dependencies?: number[] | undefined;
}>;
export type ParsedIssue = z.infer<typeof ParsedIssueSchema>;
/**
 * GitHub context for issue creation
 */
export interface GitHubContext {
    repo: string;
    owner: string;
    prNumber?: number;
    issueNumber?: number;
    commentBody: string;
    prTitle?: string;
    prDescription?: string;
    commitMessages?: string[];
    isResolved?: boolean;
}
/**
 * Configuration for gitlin bot
 */
export interface GitlinConfig {
    linearApiKey: string;
    linearTeamId: string;
    anthropicApiKey: string;
    githubToken: string;
    /** Default priority if not specified */
    defaultPriority?: keyof typeof Priority;
    /** Label mapping for auto-tagging */
    labelMapping?: Record<string, string[]>;
    /** Effort estimate mapping to Linear points */
    effortMapping?: Record<Effort, number>;
    /** Auto-tag to add to all created issues */
    gitlinAutoTag?: string;
    /** Skip issues from resolved comment threads */
    skipResolvedComments?: boolean;
}
/**
 * Result of creating Linear issues
 */
export interface CreateIssuesResult {
    success: boolean;
    issues: Array<{
        title: string;
        linearId: string;
        url: string;
    }>;
    errors: string[];
}
//# sourceMappingURL=types.d.ts.map