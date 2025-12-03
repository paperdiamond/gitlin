import { LinearClient as LinearSDK } from "@linear/sdk";
import {
  ParsedIssue,
  Priority,
  CreateIssuesResult,
  GitlinConfig,
} from "./types.js";

/**
 * Linear API client for creating issues
 */
export class LinearClient {
  private client: LinearSDK;
  private config: GitlinConfig;

  constructor(config: GitlinConfig) {
    this.client = new LinearSDK({ apiKey: config.linearApiKey });
    this.config = config;
  }

  /**
   * Create multiple Linear issues from parsed data
   */
  async createIssues(
    issues: ParsedIssue[],
    prUrl?: string,
  ): Promise<CreateIssuesResult> {
    const result: CreateIssuesResult = {
      success: true,
      issues: [],
      errors: [],
    };

    // Create issues sequentially to handle dependencies
    const createdIssues: Map<number, string> = new Map();

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];

      try {
        const linearIssue = await this.createIssue(issue, createdIssues, prUrl);

        result.issues.push({
          title: issue.title,
          linearId: linearIssue.identifier,
          url: linearIssue.url,
        });

        createdIssues.set(i, linearIssue.id);
      } catch (error) {
        const errorMsg = `Failed to create issue "${issue.title}": ${error}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Create a single Linear issue
   */
  private async createIssue(
    issue: ParsedIssue,
    createdIssues: Map<number, string>,
    prUrl?: string,
  ) {
    // Map priority string to Linear priority number (case-insensitive)
    const priorityMap: Record<string, Priority> = {
      urgent: Priority.Urgent,
      high: Priority.High,
      medium: Priority.Medium,
      low: Priority.Low,
    };

    const priority =
      priorityMap[issue.priority.toLowerCase()] ?? Priority.Medium;

    // Build description with PR context
    let description = issue.description;

    if (prUrl) {
      description += `\n\n---\n\n**Related PR:** ${prUrl}`;
    }

    if (issue.effort) {
      description += `\n**Estimated Effort:** ${issue.effort}`;
    }

    // Get label IDs if labels are provided
    const labelIds: string[] = [];
    if (issue.labels && issue.labels.length > 0) {
      const labels = await this.client.issueLabels();
      const labelMap = new Map(
        labels.nodes.map((label) => [label.name.toLowerCase(), label.id]),
      );

      for (const labelName of issue.labels) {
        const labelId = labelMap.get(labelName.toLowerCase());
        if (labelId) {
          labelIds.push(labelId);
        }
      }
    }

    // Get assignee ID if assignee is provided
    let assigneeId: string | undefined;
    if (issue.assignee && issue.assignee.toLowerCase() !== "unassigned") {
      try {
        const users = await this.client.users();
        // Try to match by email, name, or displayName
        const user = users.nodes.find(
          (u) =>
            u.email?.toLowerCase() === issue.assignee?.toLowerCase() ||
            u.name?.toLowerCase() === issue.assignee?.toLowerCase() ||
            u.displayName?.toLowerCase() === issue.assignee?.toLowerCase(),
        );

        if (user) {
          assigneeId = user.id;
        } else {
          console.warn(
            `Could not find Linear user for assignee: ${issue.assignee}. Issue will be unassigned.`,
          );
        }
      } catch (error) {
        console.warn(`Failed to look up assignee: ${error}`);
      }
    }

    // Create the issue
    const payload = await this.client.createIssue({
      teamId: this.config.linearTeamId,
      title: issue.title,
      description,
      priority,
      labelIds: labelIds.length > 0 ? labelIds : undefined,
      assigneeId,
    });

    if (!payload.success || !payload.issue) {
      throw new Error("Failed to create Linear issue");
    }

    const createdIssue = await payload.issue;

    // TODO: Handle dependencies by creating relations
    // The Linear SDK types for createIssueRelation need to be investigated
    // For now, dependencies are documented in the description
    if (issue.dependencies && issue.dependencies.length > 0) {
      const depIds = issue.dependencies
        .map((idx) => createdIssues.get(idx))
        .filter(Boolean);
      if (depIds.length > 0) {
        // Add dependency info to description
        description += `\n\n**Dependencies:** This issue depends on other issues being completed first.`;
      }
    }

    return createdIssue;
  }

  /**
   * Verify API connection and team access
   */
  async verify(): Promise<boolean> {
    try {
      const team = await this.client.team(this.config.linearTeamId);
      console.log(`Connected to Linear team: ${team.name}`);
      return true;
    } catch (error) {
      console.error("Failed to verify Linear connection:", error);
      return false;
    }
  }
}
