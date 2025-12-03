import { z } from "zod";

/**
 * Priority levels for Linear issues
 */
export enum Priority {
  Urgent = 0,
  High = 1,
  Medium = 2,
  Low = 3,
  NoPriority = 4,
}

/**
 * Effort estimate for Linear issues
 */
export type Effort = "Small" | "Medium" | "Large";

/**
 * Parsed issue from AI
 */
export const ParsedIssueSchema = z.object({
  title: z.string().min(1).describe("Concise, actionable title"),
  description: z
    .string()
    .min(1)
    .describe("Detailed description with context and rationale"),
  priority: z
    .enum(["urgent", "high", "medium", "low"])
    .describe("Priority level based on impact and urgency"),
  effort: z
    .enum(["small", "medium", "large"])
    .optional()
    .describe("Estimated effort to complete"),
  labels: z
    .array(z.string())
    .optional()
    .describe("Labels like security, refactor, bug, enhancement"),
  assignee: z
    .string()
    .optional()
    .describe("Assignee email, name, or 'Unassigned'"),
  dependencies: z
    .array(z.number())
    .optional()
    .describe("Array of issue indices that must be completed first"),
});

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
