# Contributing to gitlin

Thanks for your interest in contributing to gitlin! This guide will help you get started.

## Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Write tests for new functionality
5. Update documentation (see below)
6. Commit your changes
7. Push to your fork
8. Open a Pull Request

## Code Standards

- **TypeScript**: Use strict mode, avoid `any` unless necessary
- **Formatting**: Run `pnpm format` before committing
- **Linting**: Run `pnpm lint` to check for issues
- **Testing**: Add tests for new features (we use Vitest)

## Documentation Requirements

**⚠️ IMPORTANT: Always update documentation when making changes!**

When you modify code, you MUST update the relevant documentation:

### 1. README.md
Update the README when you:
- Add new features or functionality
- Change how the bot behaves
- Modify the setup process
- Add new configuration options
- Change examples or use cases

### 2. Code Comments
- Add JSDoc comments for public functions
- Explain complex logic with inline comments
- Document why decisions were made, not just what the code does

### 3. Examples
- Update examples in README to reflect new features
- Keep examples realistic and useful
- Show best practices, not edge cases

### 4. Configuration
- Document new configuration options in README
- Update `.github/gitlin.json` example if adding config
- Explain what each option does and when to use it

## Testing Locally

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

## Testing the GitHub Action

To test the full workflow:

1. Run `pnpm run setup` in a test repository
2. Create a test PR
3. Comment `/create-issues` with sample tasks
4. Verify Linear issues are created correctly

## Commit Messages

Use conventional commits format:

```
<type>: <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
- `feat: Add support for custom priority levels`
- `fix: Handle empty PR descriptions gracefully`
- `docs: Update README with assignee examples`

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code builds without errors (`pnpm build`)
- [ ] All tests pass (`pnpm test`)
- [ ] Code is formatted (`pnpm format`)
- [ ] No linting errors (`pnpm lint`)
- [ ] **README.md is updated** (if applicable)
- [ ] New features have tests
- [ ] Examples are updated (if behavior changed)
- [ ] Commit messages follow conventions

## Questions?

Open an issue or start a discussion on GitHub!
