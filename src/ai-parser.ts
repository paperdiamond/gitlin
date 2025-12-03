import Anthropic from "@anthropic-ai/sdk";
import { GitHubContext, ParsedIssue, ParsedIssueSchema } from "./types.js";

/**
 * Parse GitHub comment/PR content and extract actionable Linear issues using AI
 */
export class AIParser {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Extract actionable issues from GitHub context
   */
  async parseIssues(
    context: GitHubContext,
    availableLabels?: string[],
  ): Promise<ParsedIssue[]> {
    const prompt = this.buildPrompt(context, availableLabels);

    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0.3, // Lower temperature for more consistent output
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract JSON from response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Expected text response from Claude");
    }

    const jsonMatch = content.text.match(/```json\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : content.text;

    try {
      const parsed = JSON.parse(jsonText);
      const issues = Array.isArray(parsed) ? parsed : [parsed];

      // Validate each issue with Zod
      return issues.map((issue) => ParsedIssueSchema.parse(issue));
    } catch (error) {
      console.error("Failed to parse AI response:", content.text);
      throw new Error(`Failed to parse issues from AI response: ${error}`);
    }
  }

  /**
   * Build the prompt for Claude based on GitHub context
   */
  private buildPrompt(
    context: GitHubContext,
    availableLabels?: string[],
  ): string {
    let prompt = `You are an expert engineering project manager. Analyze the following GitHub content and extract actionable items that should become Linear issues.

Repository: ${context.owner}/${context.repo}
`;

    if (context.prNumber) {
      prompt += `\nPull Request: #${context.prNumber}`;
      if (context.prTitle) {
        prompt += `\nPR Title: ${context.prTitle}`;
      }
      if (context.prDescription) {
        prompt += `\nPR Description:\n${context.prDescription}`;
      }
    }

    if (context.issueNumber) {
      prompt += `\nIssue: #${context.issueNumber}`;
    }

    if (context.commitMessages && context.commitMessages.length > 0) {
      prompt += `\n\nRecent Commits:\n${context.commitMessages.join("\n")}`;
    }

    prompt += `\n\nComment/Content to Analyze:\n${context.commentBody}`;

    // Add available labels to prompt
    if (availableLabels && availableLabels.length > 0) {
      prompt += `\n\nAVAILABLE LINEAR LABELS:\n${availableLabels.join(", ")}`;
      prompt += `\n\nUse these labels when applicable. You may suggest labels not in this list if they're more appropriate.`;
    }

    prompt += `

TASK: Extract actionable items that should become Linear issues. For each item:

1. **Title**: Concise, starts with a verb (e.g., "Add error boundaries to IDE panels")
2. **Description**: Detailed explanation including:
   - WHY this needs to be done (context, problem)
   - WHAT should be done (specific tasks)
   - Any technical considerations or constraints
3. **Priority** (be conservative - most issues should be medium or low):
   - "urgent" - ONLY use for: production is down, security vulnerability being exploited, data loss risk, or blocking all work
   - "high" - Impacts users directly, critical bugs (not blocking), important features explicitly marked as high priority
   - "medium" - DEFAULT for most work: bugs without user impact, refactoring, technical debt, performance improvements
   - "low" - Nice-to-have enhancements, future ideas, minor improvements, cosmetic changes
4. **Effort**:
   - "small" - Hours (< 1 day)
   - "medium" - Days (1-3 days)
   - "large" - Week+ (> 3 days)
5. **Labels**: Array of relevant tags like ["security", "refactor", "bug", "enhancement", "technical-debt"]
6. **Dependencies**: Array of indices (0-based) of issues that must be completed first

IMPORTANT RULES:
- Only extract items that are clearly actionable (not vague ideas)
- Combine related sub-tasks into single issues unless they're truly independent
- If text mentions "follow-up" or "TODO" or "should", consider it actionable
- Ignore items already completed or in progress
- If priority/effort unclear, use "medium"

PRIORITY GUIDELINES (common patterns):
- "Bug" or "Fix" → medium (unless explicitly critical or blocking)
- "Refactor" or "Extract" → medium
- "Security" → high (only urgent if actively exploited)
- "Performance" or "Optimization" → medium
- "Enhancement" or "Nice-to-have" → low
- "Add tests" or "Improve coverage" → medium
- Phrases like "consider", "might want to", "could be nice" → low

Return ONLY a JSON array of issues, no other text:

\`\`\`json
[
  {
    "title": "Add error boundaries to IDE panels",
    "description": "Currently...",
    "priority": "high",
    "effort": "small",
    "labels": ["bug", "resilience"],
    "dependencies": []
  }
]
\`\`\`

If no actionable items found, return empty array: \`\`\`json\n[]\n\`\`\`
`;

    return prompt;
  }
}
