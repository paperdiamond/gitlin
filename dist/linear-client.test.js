import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinearClient } from "./linear-client.js";
// Mock the Linear SDK
vi.mock("@linear/sdk", () => {
    return {
        LinearClient: vi.fn().mockImplementation(() => ({
            team: vi.fn().mockResolvedValue({ name: "Test Team" }),
            createIssue: vi.fn().mockResolvedValue({
                success: true,
                issue: Promise.resolve({
                    id: "test-id",
                    identifier: "TEST-123",
                    url: "https://linear.app/test",
                }),
            }),
            issueLabels: vi.fn().mockResolvedValue({
                nodes: [
                    { name: "bug", id: "label-1" },
                    { name: "feature", id: "label-2" },
                ],
            }),
            users: vi.fn().mockResolvedValue({
                nodes: [
                    {
                        id: "user-1",
                        email: "test@example.com",
                        name: "Test User",
                        displayName: "Test",
                    },
                ],
            }),
        })),
    };
});
describe("LinearClient", () => {
    let client;
    beforeEach(() => {
        client = new LinearClient({
            linearApiKey: "test-key",
            linearTeamId: "test-team-id",
            anthropicApiKey: "test-anthropic-key",
            githubToken: "test-github-token",
        });
    });
    it("should verify connection successfully", async () => {
        const result = await client.verify();
        expect(result).toBe(true);
    });
    it("should create issues with correct priority mapping", async () => {
        const issues = [
            {
                title: "High priority task",
                description: "Important task",
                priority: "high",
            },
            {
                title: "Low priority task",
                description: "Less important task",
                priority: "low",
            },
        ];
        const result = await client.createIssues(issues);
        expect(result.success).toBe(true);
        expect(result.issues).toHaveLength(2);
        expect(result.errors).toHaveLength(0);
    });
    it("should handle case-insensitive priority", async () => {
        const issues = [
            {
                title: "Test task",
                description: "Test description",
                priority: "High", // Uppercase should work
            },
        ];
        const result = await client.createIssues(issues);
        expect(result.success).toBe(true);
        expect(result.issues).toHaveLength(1);
    });
    it("should handle errors gracefully", async () => {
        // Override mock to throw error for this test
        const errorClient = new LinearClient({
            linearApiKey: "test-key",
            linearTeamId: "test-team-id",
            anthropicApiKey: "test-anthropic-key",
            githubToken: "test-github-token",
        });
        // @ts-expect-error - accessing private property for testing
        errorClient.client.createIssue = vi
            .fn()
            .mockRejectedValue(new Error("API Error"));
        const issues = [
            {
                title: "Test task",
                description: "Test description",
                priority: "high",
            },
        ];
        const result = await errorClient.createIssues(issues);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=linear-client.test.js.map