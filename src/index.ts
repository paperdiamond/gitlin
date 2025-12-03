import { Octokit } from "@octokit/rest";
import { AIParser } from "./ai-parser.js";
import { LinearClient } from "./linear-client.js";
import { GitHubContext, GitlinConfig, CommentData } from "./types.js";

/**
 * Main gitlin bot
 */
export class Gitlin {
  private config: GitlinConfig;
  private aiParser: AIParser;
  private linearClient: LinearClient;
  private octokit: Octokit;

  constructor(config: GitlinConfig) {
    this.config = config;
    this.aiParser = new AIParser(config.anthropicApiKey);
    this.linearClient = new LinearClient(config);
    this.octokit = new Octokit({ auth: config.githubToken });
  }

  /**
   * Fetch all comments on a PR (both issue comments and review comments)
   * Filters out resolved review comment threads
   */
  private async fetchAllPRComments(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<CommentData[]> {
    console.log(`Fetching all comments from PR #${prNumber}...`);

    // Fetch issue comments
    const issueComments = await this.octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    // Fetch review comments
    const reviewComments = await this.octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Fetch resolution status via GraphQL
    const query = `
      query($owner: String!, $repo: String!, $pr: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $pr) {
            reviewThreads(first: 100) {
              nodes {
                comments(first: 10) {
                  nodes { databaseId }
                }
                isResolved
              }
            }
          }
        }
      }
    `;

    const resolutionData: any = await this.octokit.graphql(query, {
      owner,
      repo,
      pr: prNumber,
    });

    // Build resolution map (databaseId -> isResolved)
    const resolutionMap = new Map<number, boolean>();
    for (const thread of resolutionData.repository.pullRequest.reviewThreads
      .nodes) {
      for (const comment of thread.comments.nodes) {
        if (comment.databaseId) {
          resolutionMap.set(comment.databaseId, thread.isResolved);
        }
      }
    }

    // Collect all unresolved comments with metadata
    const allComments: CommentData[] = [];

    // Add issue comments (can't be resolved)
    for (const comment of issueComments.data) {
      if (comment.body && !comment.body.includes("/create-issues")) {
        allComments.push({
          body: comment.body,
          id: comment.id,
          htmlUrl: comment.html_url,
          type: "issue",
        });
      }
    }

    // Add unresolved review comments only
    for (const comment of reviewComments.data) {
      const isResolved = resolutionMap.get(comment.id) || false;
      if (comment.body && !isResolved) {
        allComments.push({
          body: `[${comment.path}:${comment.line}] ${comment.body}`,
          id: comment.id,
          htmlUrl: comment.html_url,
          type: "review",
        });
      }
    }

    console.log(
      `Collected ${allComments.length} unresolved comments (${issueComments.data.length} issue comments, ${allComments.filter(c => c.type === "review").length} unresolved review comments)`,
    );

    return allComments;
  }

  /**
   * Check if this PR has already been processed to avoid duplicates
   */
  private async isPRProcessed(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<boolean> {
    const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
    const prMarker = `${owner}/${repo}/pull/${prNumber}`;
    console.log(`Checking if PR has been processed: ${prUrl}...`);

    try {
      const existingIssues = await this.linearClient.findIssuesByPRUrl(prUrl);

      // Check if any issue has our tracking marker
      for (const issue of existingIssues) {
        if (issue.description?.includes(`<!-- gitlin:pr:${prMarker} -->`)) {
          console.log(`PR already processed - found ${existingIssues.length} existing issues`);
          return true;
        }
      }

      console.log(`PR not yet processed`);
      return false;
    } catch (error) {
      console.warn(`Failed to check for existing issues: ${error}`);
      return false;
    }
  }

  /**
   * Process a GitHub comment and create Linear issues
   */
  async processComment(context: GitHubContext): Promise<string> {
    console.log(`Processing comment from ${context.owner}/${context.repo}`);

    try {
      // If this is a PR, fetch all unresolved comments
      let commentBody = context.commentBody;
      let comments: CommentData[] = [];

      if (context.prNumber) {
        // Check if this PR has already been processed
        const alreadyProcessed = await this.isPRProcessed(
          context.owner,
          context.repo,
          context.prNumber,
        );

        if (alreadyProcessed) {
          return "This PR has already been processed. All comments have been converted to Linear issues. To create new issues, please add new comments and trigger the bot again on a fresh PR.";
        }

        const allComments = await this.fetchAllPRComments(
          context.owner,
          context.repo,
          context.prNumber,
        );

        if (allComments.length === 0) {
          return "No unresolved comments found on this PR.";
        }

        comments = allComments;

        // Combine all comments with separators
        commentBody = comments.map(c => c.body).join("\n\n---\n\n");
        console.log(
          `Analyzing ${comments.length} comments (${commentBody.length} characters)`,
        );
      }

      // Fetch Linear labels BEFORE AI parsing
      const linearLabels = await this.linearClient.getAvailableLabels();
      console.log(`Fetched ${linearLabels.length} Linear labels`);

      // Parse issues from comment using AI with label context
      console.log("Parsing issues with AI...");
      const issues = await this.aiParser.parseIssues(
        { ...context, commentBody },
        linearLabels,
      );

      if (issues.length === 0) {
        return "No actionable items found in the comments.";
      }

      console.log(`Found ${issues.length} actionable items`);

      // Build PR URL if available
      const prUrl = context.prNumber
        ? `https://github.com/${context.owner}/${context.repo}/pull/${context.prNumber}`
        : undefined;

      // Create Linear issues
      console.log("Creating Linear issues...");
      const result = await this.linearClient.createIssues(issues, prUrl);

      // Build response message
      let response = `✅ Created ${result.issues.length} Linear issue${result.issues.length !== 1 ? "s" : ""}:\n\n`;

      for (const issue of result.issues) {
        response += `- [${issue.linearId}](${issue.url}) ${issue.title}\n`;
      }

      if (result.errors.length > 0) {
        response += `\n⚠️ Errors:\n`;
        for (const error of result.errors) {
          response += `- ${error}\n`;
        }
      }

      return response;
    } catch (error) {
      console.error("Error processing comment:", error);
      return `❌ Failed to create Linear issues: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Post a comment on GitHub PR or issue
   */
  async postComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<void> {
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }

  /**
   * Verify all API connections
   */
  async verify(): Promise<boolean> {
    console.log("Verifying API connections...");

    try {
      // Verify Linear
      const linearOk = await this.linearClient.verify();
      if (!linearOk) {
        console.error("❌ Linear verification failed");
        return false;
      }

      // Note: We don't verify GitHub here because GITHUB_TOKEN in Actions
      // doesn't have 'user' scope. We only need it to post comments which
      // will be verified when we actually try to post.

      console.log("✅ All API connections verified");
      return true;
    } catch (error) {
      console.error("❌ Verification failed:", error);
      return false;
    }
  }

  /**
   * Add a reaction to a comment (for status updates)
   */
  async addReaction(
    owner: string,
    repo: string,
    commentId: number,
    reaction:
      | "+1"
      | "-1"
      | "laugh"
      | "confused"
      | "heart"
      | "hooray"
      | "rocket"
      | "eyes",
  ): Promise<void> {
    try {
      await this.octokit.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        content: reaction,
      });
    } catch (error) {
      console.error(`Failed to add reaction: ${error}`);
      // Don't fail the whole process if reaction fails
    }
  }
}

/**
 * Main entry point for GitHub Action
 */
export async function main() {
  // Get configuration from environment variables
  const config: GitlinConfig = {
    linearApiKey: process.env.LINEAR_API_KEY || "",
    linearTeamId: process.env.LINEAR_TEAM_ID || "",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    githubToken: process.env.GITHUB_TOKEN || "",
  };

  // Validate configuration
  if (!config.linearApiKey) {
    throw new Error("LINEAR_API_KEY environment variable is required");
  }
  if (!config.linearTeamId) {
    throw new Error("LINEAR_TEAM_ID environment variable is required");
  }
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
  if (!config.githubToken) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  // Create bot instance
  const bot = new Gitlin(config);

  // Verify connections
  const verified = await bot.verify();
  if (!verified) {
    process.exit(1);
  }

  // Get GitHub context from environment
  const context: GitHubContext = {
    owner: process.env.GITHUB_REPOSITORY_OWNER || "",
    repo: process.env.GITHUB_REPOSITORY?.split("/")[1] || "",
    prNumber: process.env.PR_NUMBER
      ? parseInt(process.env.PR_NUMBER, 10)
      : undefined,
    issueNumber: process.env.ISSUE_NUMBER
      ? parseInt(process.env.ISSUE_NUMBER, 10)
      : undefined,
    commentBody: process.env.COMMENT_BODY || "",
    prTitle: process.env.PR_TITLE,
    prDescription: process.env.PR_DESCRIPTION,
  };

  const issueNumber = context.prNumber || context.issueNumber;
  const commentId = process.env.COMMENT_ID
    ? parseInt(process.env.COMMENT_ID, 10)
    : undefined;

  try {
    // Add "eyes" reaction to show we're processing
    if (commentId) {
      await bot.addReaction(context.owner, context.repo, commentId, "eyes");
      console.log("👀 Added 'eyes' reaction to show processing...");
    }

    // Process the comment
    const response = await bot.processComment(context);

    // Add "rocket" reaction on success
    if (commentId) {
      await bot.addReaction(context.owner, context.repo, commentId, "rocket");
      console.log("🚀 Added 'rocket' reaction to show success!");
    }

    // Post response to GitHub
    if (issueNumber) {
      await bot.postComment(context.owner, context.repo, issueNumber, response);
      console.log("✅ Posted response to GitHub");
    }

    console.log("\n" + response);
  } catch (error) {
    // Add "confused" reaction on error
    if (commentId) {
      await bot.addReaction(context.owner, context.repo, commentId, "confused");
      console.log("😕 Added 'confused' reaction to show error");
    }
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
