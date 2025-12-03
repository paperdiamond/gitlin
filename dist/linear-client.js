import { LinearClient as LinearSDK } from "@linear/sdk";
import { Priority, } from "./types.js";
/**
 * Linear API client for creating issues
 */
export class LinearClient {
    client;
    config;
    labelCache;
    constructor(config) {
        this.client = new LinearSDK({ apiKey: config.linearApiKey });
        this.config = config;
    }
    /**
     * Create multiple Linear issues from parsed data
     */
    async createIssues(issues, prUrl) {
        const result = {
            success: true,
            issues: [],
            errors: [],
        };
        // Create issues sequentially to handle dependencies
        const createdIssues = new Map();
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
            }
            catch (error) {
                const errorMsg = `Failed to create issue "${issue.title}": ${error}`;
                console.error(errorMsg);
                result.errors.push(errorMsg);
                result.success = false;
            }
        }
        return result;
    }
    /**
     * Get available Linear labels (cached)
     */
    async getAvailableLabels() {
        if (!this.labelCache) {
            await this.refreshLabelCache();
        }
        return Array.from(this.labelCache.keys());
    }
    /**
     * Refresh label cache from Linear API
     */
    async refreshLabelCache() {
        const labels = await this.client.issueLabels();
        this.labelCache = new Map(labels.nodes.map((label) => [label.name.toLowerCase(), label.id]));
    }
    /**
     * Apply label mapping from config
     */
    applyLabelMapping(labels) {
        if (!this.config.labelMapping) {
            return labels;
        }
        const expandedLabels = new Set(labels);
        for (const label of labels) {
            const mapped = this.config.labelMapping[label.toLowerCase()];
            if (mapped) {
                mapped.forEach((l) => expandedLabels.add(l));
            }
        }
        return Array.from(expandedLabels);
    }
    /**
     * Create a single Linear issue
     */
    async createIssue(issue, createdIssues, prUrl) {
        // Map priority string to Linear priority number (case-insensitive)
        const priorityMap = {
            urgent: Priority.Urgent,
            high: Priority.High,
            medium: Priority.Medium,
            low: Priority.Low,
        };
        const priority = priorityMap[issue.priority.toLowerCase()] ?? Priority.Medium;
        // Build description with PR context
        let description = issue.description;
        if (prUrl) {
            description += `\n\n---\n\n**Related PR:** ${prUrl}`;
        }
        if (issue.effort) {
            description += `\n**Estimated Effort:** ${issue.effort}`;
        }
        // Refresh cache if needed
        if (!this.labelCache) {
            await this.refreshLabelCache();
        }
        // Apply label mapping from config
        const labelsToApply = issue.labels
            ? this.applyLabelMapping(issue.labels)
            : [];
        // Add gitlin-created auto-tag
        const autoTag = this.config.gitlinAutoTag || "gitlin-created";
        labelsToApply.push(autoTag);
        // Get label IDs (create missing auto-tags)
        // Use Set to ensure uniqueness
        const labelIdSet = new Set();
        for (const labelName of labelsToApply) {
            let labelId = this.labelCache.get(labelName.toLowerCase());
            // Auto-create gitlin tag if missing
            if (!labelId && labelName === autoTag) {
                try {
                    const payload = await this.client.createIssueLabel({
                        name: autoTag,
                        color: "#7C3AED", // Purple
                        teamId: this.config.linearTeamId,
                    });
                    const newLabel = await payload.issueLabel;
                    labelId = newLabel?.id;
                    if (labelId && this.labelCache) {
                        this.labelCache.set(labelName.toLowerCase(), labelId);
                    }
                }
                catch (error) {
                    console.warn(`Failed to create auto-tag label "${autoTag}": ${error}`);
                }
            }
            if (labelId) {
                labelIdSet.add(labelId);
            }
            else {
                console.warn(`Label not found in Linear: ${labelName}`);
            }
        }
        const labelIds = Array.from(labelIdSet);
        // Get assignee ID if assignee is provided
        let assigneeId;
        if (issue.assignee && issue.assignee.toLowerCase() !== "unassigned") {
            try {
                const users = await this.client.users();
                // Try to match by email, name, or displayName
                const user = users.nodes.find((u) => u.email?.toLowerCase() === issue.assignee?.toLowerCase() ||
                    u.name?.toLowerCase() === issue.assignee?.toLowerCase() ||
                    u.displayName?.toLowerCase() === issue.assignee?.toLowerCase());
                if (user) {
                    assigneeId = user.id;
                }
                else {
                    console.warn(`Could not find Linear user for assignee: ${issue.assignee}. Issue will be unassigned.`);
                }
            }
            catch (error) {
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
    async verify() {
        try {
            const team = await this.client.team(this.config.linearTeamId);
            console.log(`Connected to Linear team: ${team.name}`);
            return true;
        }
        catch (error) {
            console.error("Failed to verify Linear connection:", error);
            return false;
        }
    }
}
//# sourceMappingURL=linear-client.js.map