# gitlin 🤖

> AI-powered GitHub bot that creates Linear issues from code reviews, PRs, and commits.

Stop manually copying tasks from code reviews into Linear. Just comment `/create-issues` and let Claude do the work.

## Features

- ✨ **AI-Powered Extraction** - Uses Claude to intelligently parse comments, reviews, and PRs
- 📋 **Smart Issue Creation** - Automatically populates title, description, priority, effort, labels, and assignees
- 🔗 **Dependency Management** - Links related issues automatically
- 👀 **Visual Feedback** - Emoji reactions show processing status (eyes → rocket on success)
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults
- 🎯 **Context-Aware** - Understands PR context, commit history, and review feedback
- 🔐 **Secure** - Auto-fetches Linear team UUID, validates origins, minimal permissions

## Quick Start

### Option 1: Automatic Setup (Recommended)

Clone this repo into your project and run the interactive setup:

```bash
cd your-project
git clone https://github.com/paperdiamond/gitlin.git .gitlin
cd .gitlin
pnpm install
pnpm run setup
```

The setup wizard will:
- Install the GitHub Action workflow
- Automatically fetch your Linear teams and let you select one (no manual UUID lookup!)
- Add required secrets to your repository (via GitHub CLI)
- Verify everything is configured correctly

### Option 2: Manual Setup

If you prefer to set things up manually:

**1. Add the GitHub Action workflow**

Create `.github/workflows/gitlin.yml`:

```yaml
name: Gitlin - Create Linear Issues
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  create-issues:
    if: contains(github.event.comment.body, '/create-issues')
    uses: paperdiamond/gitlin/.github/workflows/gitlin-bot.yml@main
    secrets:
      LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}
      LINEAR_TEAM_ID: ${{ secrets.LINEAR_TEAM_ID }}
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**2. Add Secrets**

Go to your repository's Settings → Secrets → Actions and add:

- `LINEAR_API_KEY` - Get from https://linear.app/settings/api
- `LINEAR_TEAM_ID` - Your Linear team UUID (get it by running `node scripts/get-team-id.js` in the gitlin directory)
- `ANTHROPIC_API_KEY` - Get from https://console.anthropic.com/

### Use It!

Comment `/create-issues` on any PR or issue, and the bot will:
1. Parse the comment and surrounding context
2. Extract actionable items using AI
3. Create Linear issues with full details
4. Reply with links to the created issues

## Examples

### From Code Review Feedback

**GitHub Comment:**
```
Great work on the feature! A few things to address:

1. Add input validation for user email addresses
2. Extract the authentication logic into a reusable service
3. Consider adding rate limiting to the API endpoints

The security changes look good though!

/create-issues
```

**gitlin creates:**
```
✅ Created 3 Linear issues:

- [PROJ-123](https://linear.app/team/issue/PROJ-123) Add input validation for user email addresses
  Priority: High | Effort: Small | Assignee: alex@company.com

- [PROJ-124](https://linear.app/team/issue/PROJ-124) Extract authentication logic into reusable service
  Priority: Medium | Effort: Medium | Assignee: taylor@company.com

- [PROJ-125](https://linear.app/team/issue/PROJ-125) Add rate limiting to API endpoints
  Priority: Low | Effort: Large | Assignee: Unassigned
```

### From Commit Messages

The bot can also parse commit messages with follow-up items:

```
feat: Add user authentication with OAuth

## Follow-up Items

1. Add comprehensive error handling for auth failures (High priority, 3 points, jordan@company.com)
   - Display user-friendly error messages for common auth failures
   - Log authentication errors to monitoring service
   - Add retry mechanism for transient failures

2. Implement session refresh token rotation (Medium priority, 5 points, casey@company.com)
   - Automatically refresh access tokens before expiration
   - Handle refresh token expiration gracefully
   - Add security audit logging for token refresh events

3. Add multi-factor authentication support (Low priority, 8 points, Unassigned)
   - Research MFA provider options (Authy, Google Authenticator)
   - Design user enrollment flow
   - Implement backup codes for account recovery

/create-issues
```

## How It Works

```mermaid
graph LR
    A[Comment on GitHub] --> B[Trigger GitHub Action]
    B --> C[Extract Context]
    C --> D[AI Parser Claude]
    D --> E[Create Linear Issues]
    E --> F[Post Results]
```

1. **Trigger**: User comments `/create-issues`
2. **Context**: Bot gathers PR title, description, commits, and comment
3. **AI Parse**: Claude analyzes content and extracts structured issues
4. **Validation**: Zod validates the parsed data structure
5. **Creation**: Linear SDK creates issues with all fields
6. **Response**: Bot replies with links to created issues

## Configuration

Create `.github/gitlin.json` to customize behavior:

```json
{
  "defaultPriority": "medium",
  "labelMapping": {
    "security": ["security", "vulnerability"],
    "performance": ["performance", "optimization"],
    "ui": ["frontend", "design"]
  },
  "effortMapping": {
    "small": 1,
    "medium": 3,
    "large": 5
  }
}
```

## Development

### Setup

```bash
git clone https://github.com/yourusername/gitlin.git
cd gitlin
pnpm install
cp .env.example .env  # Add your API keys
```

### Run Locally

```bash
pnpm run dev
```

### Test

```bash
pnpm test              # Run tests once
pnpm test:watch        # Run tests in watch mode
pnpm lint              # Check for lint errors
pnpm format:check      # Check formatting
```

**CI/CD:** All PRs run automated tests via GitHub Actions. Tests must pass before merging.

### Build

```bash
pnpm run build
```

## API

### Programmatic Usage

```typescript
import { Gitlin } from "gitlin";

const bot = new Gitlin({
  linearApiKey: "lin_api_...",
  linearTeamId: "abc123",
  anthropicApiKey: "sk-ant-...",
  githubToken: "ghp_...",
});

const result = await bot.processComment({
  owner: "acme",
  repo: "project",
  prNumber: 42,
  commentBody: "Add error handling\n\n/create-issues",
});

console.log(result);
// ✅ Created 1 Linear issue:
// - [ACME-123](https://linear.app/...) Add error handling
```

## Cost

gitlin uses Claude Sonnet which costs approximately:
- **$0.01-0.05 per run** (depending on context size)
- Average PR review: ~$0.02
- 500 uses/month: ~$10

This pays for itself immediately by saving 5-10 minutes per code review.

## Roadmap

- [ ] Support for multiple Linear teams
- [ ] GitHub Issue templates
- [ ] Slack integration
- [ ] Custom AI models (GPT-4, local models)
- [ ] Batch issue editing before creation
- [ ] Integration with GitHub Projects

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT © Paper Diamond

---

**Built with** ❤️ **by Paper Diamond**
