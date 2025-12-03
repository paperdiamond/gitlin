import { describe, it, expect } from "vitest";
import { ParsedIssueSchema } from "./types.js";

describe("ParsedIssueSchema", () => {
  it("should validate a complete issue", () => {
    const validIssue = {
      title: "Add error handling",
      description: "Implement comprehensive error handling for API failures",
      priority: "high",
      effort: "medium",
      labels: ["bug", "backend"],
      assignee: "user@example.com",
      dependencies: [0, 1],
    };

    const result = ParsedIssueSchema.safeParse(validIssue);
    expect(result.success).toBe(true);
  });

  it("should validate a minimal issue", () => {
    const minimalIssue = {
      title: "Fix bug",
      description: "Fix the authentication bug",
      priority: "urgent",
    };

    const result = ParsedIssueSchema.safeParse(minimalIssue);
    expect(result.success).toBe(true);
  });

  it("should reject issue with invalid priority", () => {
    const invalidIssue = {
      title: "Test",
      description: "Test description",
      priority: "critical", // Invalid priority
    };

    const result = ParsedIssueSchema.safeParse(invalidIssue);
    expect(result.success).toBe(false);
  });

  it("should reject issue without title", () => {
    const invalidIssue = {
      description: "Test description",
      priority: "high",
    };

    const result = ParsedIssueSchema.safeParse(invalidIssue);
    expect(result.success).toBe(false);
  });

  it("should accept all valid priority levels", () => {
    const priorities = ["urgent", "high", "medium", "low"];

    priorities.forEach((priority) => {
      const issue = {
        title: "Test",
        description: "Test description",
        priority,
      };

      const result = ParsedIssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
    });
  });

  it("should accept all valid effort levels", () => {
    const efforts = ["small", "medium", "large"];

    efforts.forEach((effort) => {
      const issue = {
        title: "Test",
        description: "Test description",
        priority: "high",
        effort,
      };

      const result = ParsedIssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
    });
  });
});
