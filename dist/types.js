import { z } from "zod";
/**
 * Priority levels for Linear issues
 */
export var Priority;
(function (Priority) {
    Priority[Priority["Urgent"] = 0] = "Urgent";
    Priority[Priority["High"] = 1] = "High";
    Priority[Priority["Medium"] = 2] = "Medium";
    Priority[Priority["Low"] = 3] = "Low";
    Priority[Priority["NoPriority"] = 4] = "NoPriority";
})(Priority || (Priority = {}));
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
//# sourceMappingURL=types.js.map