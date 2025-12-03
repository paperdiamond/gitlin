import { Octokit } from "@octokit/rest";
import { AIParser } from "./ai-parser.js";
import { LinearClient } from "./linear-client.js";
import { GitHubContext, GitlinConfig } from "./types.js";

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
   * Process a GitHub comment and create Linear issues
   */
  async processComment(context: GitHubContext): Promise<string> {
    console.log(`Processing comment from ${context.owner}/${context.repo}`);

    try {
      // Parse issues from comment using AI
      console.log("Parsing issues with AI...");
      const issues = await this.aiParser.parseIssues(context);

      if (issues.length === 0) {
        return "No actionable items found in the comment.";
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
