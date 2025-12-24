# Contributing to FlowPost

First off, thank you for considering contributing to FlowPost! 🎉

This document provides guidelines and steps for contributing. Following these guidelines helps maintain a clean codebase and makes the review process smoother.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Types of Contributions

- 🐛 **Bug fixes**: Found a bug? Check if it's already reported, then submit a fix!
- ✨ **New features**: Have an idea? Open an issue first to discuss it.
- 📝 **Documentation**: Help improve our docs, README, or code comments.
- 🧪 **Tests**: Add missing tests or improve existing ones.
- 🎨 **UI/UX improvements**: Make the dashboard more beautiful and user-friendly.

### First-time Contributors

Look for issues labeled [`good first issue`](https://github.com/Abby263/flowpost/labels/good%20first%20issue) - these are great starting points!

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm (for frontend)
- yarn (for backend)
- Docker (optional)

### Setup Steps

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/flowpost.git
cd flowpost

# 2. Add upstream remote
git remote add upstream https://github.com/Abby263/flowpost.git

# 3. Install dependencies
yarn install
cd frontend && pnpm install && cd ..

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# 5. Start development servers
./run.sh
```

### Project Structure

```
flowpost/
├── backend/          # LangGraph AI agents
├── frontend/         # Next.js dashboard
├── terraform/        # Infrastructure as Code
├── tests/            # All test files
├── docs/             # Documentation
└── scripts/          # Utility scripts
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-tiktok-integration`
- `fix/instagram-login-error`
- `docs/update-deployment-guide`
- `refactor/cleanup-agent-code`

### Workflow

```bash
# 1. Create a new branch from main
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name

# 2. Make your changes
# ... code ...

# 3. Run tests
yarn test
cd frontend && pnpm test && cd ..

# 4. Commit your changes (see commit guidelines)
git add .
git commit -m "feat: add new feature"

# 5. Push to your fork
git push origin feature/your-feature-name

# 6. Create a Pull Request
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `style`    | Code style (formatting, semicolons, etc.)               |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or updating tests                                |
| `chore`    | Maintenance tasks                                       |
| `ci`       | CI/CD changes                                           |

### Examples

```bash
feat(frontend): add dark mode toggle
fix(instagram): resolve authentication timeout
docs: update installation instructions
refactor(agents): simplify content generation logic
test(backend): add unit tests for date utilities
```

## Pull Request Process

1. **Update documentation** if your changes affect it
2. **Add/update tests** for your changes
3. **Ensure all tests pass** before submitting
4. **Fill out the PR template** completely
5. **Request review** from maintainers
6. **Address review feedback** promptly

### PR Title Format

Follow the same format as commits:

```
feat(scope): description of change
```

### Review Process

- PRs require at least 1 approval before merging
- CI checks must pass
- Merge conflicts must be resolved

## Style Guide

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Use meaningful variable names
- Add JSDoc comments for public functions

```typescript
/**
 * Generates a social media post using AI
 * @param topic - The topic to generate content about
 * @param platform - Target social media platform
 * @returns Generated post content
 */
async function generatePost(topic: string, platform: Platform): Promise<Post> {
  // Implementation
}
```

### React (Frontend)

- Use functional components with hooks
- Follow the component file structure:
  ```
  components/
  ├── component-name.tsx
  └── ui/
      └── button.tsx
  ```
- Use Tailwind CSS for styling
- Prefer shadcn/ui components

### LangGraph (Backend)

- Keep agents modular and focused
- Document state schemas
- Add proper error handling
- Use meaningful node names

## Testing

### Running Tests

```bash
# All tests
yarn test

# Backend unit tests
yarn test:backend

# Frontend unit tests
cd frontend && pnpm test

# E2E tests
yarn test:e2e
```

### Writing Tests

- Place tests in the `tests/` directory
- Mirror the source file structure
- Use descriptive test names
- Test edge cases

```typescript
describe("generatePost", () => {
  it("should generate valid Instagram post", async () => {
    // Test implementation
  });

  it("should handle API errors gracefully", async () => {
    // Test implementation
  });
});
```

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for new functions
- Update relevant docs in `/docs` folder
- Include code examples where helpful

## Questions?

- Open a [Discussion](https://github.com/Abby263/flowpost/discussions) for questions
- Check existing issues before creating new ones
- Join our community for real-time help

---

Thank you for contributing to FlowPost! 🚀
