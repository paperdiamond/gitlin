import { Octokit } from "@octokit/rest";
import { AIParser } from "./ai-parser.js";
import { LinearClient } from "./linear-client.js";
/**
 * Main gitlin bot
 */
export class Gitlin {
    config;
    aiParser;
    linearClient;
    octokit;
    constructor(config) {
        this.config = config;
        this.aiParser = new AIParser(config.anthropicApiKey);
        this.linearClient = new LinearClient(config);
        this.octokit = new Octokit({ auth: config.githubToken });
    }
    /**
     * Fetch all comments on a PR (both issue comments and review comments)
     * Filters out resolved review comment threads
     */
    async fetchAllPRComments(owner, repo, prNumber) {
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
        const resolutionData = await this.octokit.graphql(query, {
            owner,
            repo,
            pr: prNumber,
        });
        // Build resolution map (databaseId -> isResolved)
        const resolutionMap = new Map();
        for (const thread of resolutionData.repository.pullRequest.reviewThreads
            .nodes) {
            for (const comment of thread.comments.nodes) {
                if (comment.databaseId) {
                    resolutionMap.set(comment.databaseId, thread.isResolved);
                }
            }
        }
        // Collect all unresolved comments with metadata
        const allComments = [];
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
        console.log(`Collected ${allComments.length} unresolved comments (${issueComments.data.length} issue comments, ${allComments.filter(c => c.type === "review").length} unresolved review comments)`);
        return allComments;
    }
    /**
     * Check for existing Linear issues from this PR to avoid duplicates
     */
    async getProcessedCommentIds(owner, repo, prNumber) {
        const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
        console.log(`Checking for existing Linear issues from ${prUrl}...`);
        try {
            const existingIssues = await this.linearClient.findIssuesByPRUrl(prUrl);
            const processedCommentIds = new Set();
            for (const issue of existingIssues) {
                // Extract comment IDs from issue descriptions
                // Format: <!-- gitlin:comment:123456 -->
                const matches = issue.description?.matchAll(/<!-- gitlin:comment:(\d+) -->/g);
                if (matches) {
                    for (const match of matches) {
                        processedCommentIds.add(parseInt(match[1], 10));
                    }
                }
            }
            console.log(`Found ${processedCommentIds.size} already-processed comments`);
            return processedCommentIds;
        }
        catch (error) {
            console.warn(`Failed to check for existing issues: ${error}`);
            return new Set();
        }
    }
    /**
     * Process a GitHub comment and create Linear issues
     */
    async processComment(context) {
        console.log(`Processing comment from ${context.owner}/${context.repo}`);
        try {
            // If this is a PR, fetch all unresolved comments
            let commentBody = context.commentBody;
            let comments = [];
            if (context.prNumber) {
                const allComments = await this.fetchAllPRComments(context.owner, context.repo, context.prNumber);
                if (allComments.length === 0) {
                    return "No unresolved comments found on this PR.";
                }
                // Check for duplicates
                const processedIds = await this.getProcessedCommentIds(context.owner, context.repo, context.prNumber);
                // Filter out already-processed comments
                comments = allComments.filter(c => !processedIds.has(c.id));
                if (comments.length === 0) {
                    return `All ${allComments.length} comments have already been processed. No new issues to create.`;
                }
                if (comments.length < allComments.length) {
                    console.log(`Skipping ${allComments.length - comments.length} already-processed comments`);
                }
                // Combine all comments with separators
                commentBody = comments.map(c => c.body).join("\n\n---\n\n");
                console.log(`Analyzing ${comments.length} new comments (${commentBody.length} characters)`);
            }
            // Fetch Linear labels BEFORE AI parsing
            const linearLabels = await this.linearClient.getAvailableLabels();
            console.log(`Fetched ${linearLabels.length} Linear labels`);
            // Parse issues from comment using AI with label context
            console.log("Parsing issues with AI...");
            const issues = await this.aiParser.parseIssues({ ...context, commentBody }, linearLabels);
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
            const result = await this.linearClient.createIssues(issues, prUrl, comments.length > 0 ? comments : undefined);
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
        }
        catch (error) {
            console.error("Error processing comment:", error);
            return `❌ Failed to create Linear issues: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    /**
     * Post a comment on GitHub PR or issue
     */
    async postComment(owner, repo, issueNumber, body) {
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
    async verify() {
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
        }
        catch (error) {
            console.error("❌ Verification failed:", error);
            return false;
        }
    }
    /**
     * Add a reaction to a comment (for status updates)
     */
    async addReaction(owner, repo, commentId, reaction) {
        try {
            await this.octokit.reactions.createForIssueComment({
                owner,
                repo,
                comment_id: commentId,
                content: reaction,
            });
        }
        catch (error) {
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
    const config = {
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
    const context = {
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
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map