#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as readline from "readline/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    gitlin Setup Wizard                        ║
╚═══════════════════════════════════════════════════════════════╝

This will help you:
  1. Install the GitHub Action workflow
  2. Add required secrets to your repository

`);

// Check if gh CLI is installed
function checkGhCli() {
  try {
    execSync("gh --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Check if we're in a git repo
function checkGitRepo() {
  try {
    execSync("git rev-parse --git-dir", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Get current repo name
function getRepoName() {
  try {
    const remote = execSync("git remote get-url origin", {
      encoding: "utf-8",
    }).trim();
    // Extract owner/repo from git@github.com:owner/repo.git or https://github.com/owner/repo.git
    const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  // Check prerequisites
  if (!checkGitRepo()) {
    console.error("❌ Error: Not in a git repository");
    console.log(
      "\nPlease run this command from the root of the repository where you want to install gitlin.",
    );
    process.exit(1);
  }

  const hasGhCli = checkGhCli();
  if (!hasGhCli) {
    console.log("⚠️  GitHub CLI (gh) not found.");
    console.log("   Install it to automatically set repository secrets:");
    console.log("   https://cli.github.com/\n");
    console.log("   For now, we'll just install the workflow file.\n");
  }

  const repoName = getRepoName();
  if (repoName && hasGhCli) {
    console.log(`📦 Repository: ${repoName}\n`);
  }

  // Step 1: Install workflow file
  console.log("Step 1: Installing GitHub Action workflow...");

  const workflowDir = join(rootDir, ".github", "workflows");
  const workflowFile = join(workflowDir, "gitlin.yml");

  if (existsSync(workflowFile)) {
    const overwrite = await rl.question(
      "  Workflow file already exists. Overwrite? (y/N): ",
    );
    if (overwrite.toLowerCase() !== "y") {
      console.log("  Skipping workflow installation.");
    } else {
      installWorkflow(workflowDir, workflowFile);
    }
  } else {
    installWorkflow(workflowDir, workflowFile);
  }

  // Step 2: Setup secrets
  if (!hasGhCli) {
    console.log("\n\nStep 2: Setting up secrets (Manual)");
    console.log("\nSince GitHub CLI is not installed, please manually add these secrets:");
    console.log("Go to: https://github.com/" + (repoName || "YOUR_REPO") + "/settings/secrets/actions\n");
    console.log("Required secrets:");
    console.log("  • LINEAR_API_KEY      - Get from https://linear.app/settings/api");
    console.log("  • LINEAR_TEAM_ID      - Your Linear team ID");
    console.log("  • ANTHROPIC_API_KEY   - Get from https://console.anthropic.com/");
  } else {
    console.log("\n\nStep 2: Setting up GitHub secrets...");
    const setupSecrets = await rl.question(
      "\nWould you like to add secrets now? (Y/n): ",
    );

    if (setupSecrets.toLowerCase() !== "n") {
      await addSecrets();
    } else {
      console.log("\nSkipping secret setup. You can add them manually later:");
      console.log(
        "Go to: https://github.com/" + repoName + "/settings/secrets/actions",
      );
    }
  }

  console.log("\n\n✅ Setup complete!");
  console.log("\nNext steps:");
  console.log("  1. Make sure all secrets are configured");
  console.log('  2. Comment "/create-issues" on any PR to test it out');
  console.log("\nDocumentation: https://github.com/paperdiamond/gitlin\n");

  rl.close();
}

function installWorkflow(workflowDir, workflowFile) {
  mkdirSync(workflowDir, { recursive: true });

  const workflowContent = `name: Gitlin - Create Linear Issues

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  create-issues:
    # Only run if comment contains the trigger
    if: contains(github.event.comment.body, '/create-issues')
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Get PR details (if PR comment)
        if: github.event.issue.pull_request
        id: pr
        uses: actions/github-script@v7
        with:
          script: |
            const pr = await github.rest.pulls.get({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number
            });
            return {
              title: pr.data.title,
              body: pr.data.body || '',
              number: context.issue.number
            };

      - name: Run Gitlin Bot
        env:
          LINEAR_API_KEY: \${{ secrets.LINEAR_API_KEY }}
          LINEAR_TEAM_ID: \${{ secrets.LINEAR_TEAM_ID }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY_OWNER: \${{ github.repository_owner }}
          GITHUB_REPOSITORY: \${{ github.repository }}
          COMMENT_BODY: \${{ github.event.comment.body }}
          PR_NUMBER: \${{ github.event.issue.pull_request && github.event.issue.number || '' }}
          ISSUE_NUMBER: \${{ !github.event.issue.pull_request && github.event.issue.number || '' }}
          PR_TITLE: \${{ steps.pr.outputs.result && fromJSON(steps.pr.outputs.result).title || '' }}
          PR_DESCRIPTION: \${{ steps.pr.outputs.result && fromJSON(steps.pr.outputs.result).body || '' }}
        run: node dist/index.js
`;

  writeFileSync(workflowFile, workflowContent);
  console.log("  ✅ Workflow installed at .github/workflows/gitlin.yml");
}

async function addSecrets() {
  console.log("\nEnter your API keys (they will be securely added to GitHub):\n");

  const linearApiKey = await rl.question("  LINEAR_API_KEY (from https://linear.app/settings/api): ");
  const linearTeamId = await rl.question("  LINEAR_TEAM_ID (your team ID from Linear URL): ");
  const anthropicApiKey = await rl.question("  ANTHROPIC_API_KEY (from https://console.anthropic.com/): ");

  if (!linearApiKey || !linearTeamId || !anthropicApiKey) {
    console.log("\n⚠️  Some secrets were empty. Skipping secret setup.");
    return;
  }

  try {
    console.log("\n  Adding secrets to GitHub...");
    execSync(`gh secret set LINEAR_API_KEY --body "${linearApiKey}"`, {
      stdio: "ignore",
    });
    execSync(`gh secret set LINEAR_TEAM_ID --body "${linearTeamId}"`, {
      stdio: "ignore",
    });
    execSync(`gh secret set ANTHROPIC_API_KEY --body "${anthropicApiKey}"`, {
      stdio: "ignore",
    });
    console.log("  ✅ Secrets added successfully!");
  } catch (error) {
    console.error("\n❌ Failed to add secrets:", error.message);
    console.log(
      "\nPlease add them manually at your repository's secrets page.",
    );
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
