---
sidebar_position: 3
---

# Contributing

Guide to contributing to ODE, including contribution process, coding standards, and community guidelines.

## Overview

ODE is an open-source project and welcomes contributions from the community. We believe that diverse perspectives and varied skill sets make our project stronger.

## Documentation URL convention

- **`/docs/developer/*`** — Persona landing pages (overview, getting started paths)
- **`/docs/development/*`** — Substantive developer content (architecture, setup, component guides)

When adding links in docs, use the full path prefix `/docs/...`.

## Ways to Contribute

You can contribute to ODE in many ways:

- **Code Contributions**: Bug fixes, new features, improvements
- **Documentation**: Improve existing docs, add examples, fix typos
- **Testing**: Test the platform, report bugs, verify fixes
- **Community**: Help others, answer questions, share use cases
- **Design**: UI/UX improvements, design system contributions
- **Translation**: Help translate documentation and interfaces

## Contribution Process

### 1. Find Something to Work On

- Browse [GitHub Issues](https://github.com/OpenDataEnsemble/ode/issues) for open issues
- Look for issues labeled `good first issue` for beginners
- Check discussions for ideas and feature requests
- Review documentation for gaps or improvements

### 2. Set Up Development Environment

Follow the [Development Setup guide](/development/setup) to set up your local environment.

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Use descriptive branch names:
- `feature/` for new features
- `fix/` for bug fixes
- `docs/` for documentation
- `refactor/` for code refactoring

### 4. Make Your Changes

- Write clean, well-documented code
- Follow coding standards (see below)
- Add tests for new functionality
- Update documentation as needed

### 5. Test Your Changes

```bash
# Frontend projects (from each package directory; see Development Setup for pnpm)
cd formulus && pnpm run lint && pnpm run format:check && pnpm run test --ci --coverage --watchAll=false
cd formulus-formplayer && pnpm run lint && pnpm run format:check && pnpm run test run

# Go projects
cd synkronus && go test ./...
go fmt ./...
```

### 6. Commit Your Changes

Write clear, descriptive commit messages:

```
feat: Add support for custom question types

- Add interface for custom renderers
- Implement renderer registration
- Add documentation and examples
```

**Commit Message Format:**
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `style:` for formatting
- `refactor:` for code refactoring
- `test:` for tests
- `chore:` for maintenance

### 7. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Create a pull request on GitHub with:

- Clear description of changes
- Reference to related issues
- Screenshots (if UI changes)
- Testing notes

## Coding Standards

### Frontend (React/React Native)

**TypeScript:**
- Use TypeScript for all new code
- Enable strict type checking
- Define interfaces for data structures
- Avoid `any` type

**Code Style:**
- Follow ESLint rules
- Use Prettier for formatting
- Use functional components with hooks
- Keep components small and focused

**Example:**

```typescript
interface User {
  id: string;
  username: string;
  role: 'read-only' | 'read-write' | 'admin';
}

const UserProfile: React.FC<{user: User}> = ({user}) => {
  return <div>{user.username}</div>;
};
```

### Backend (Go)

**Code Style:**
- Follow `gofmt` formatting
- Use `golint` recommendations
- Write clear, descriptive function names
- Add godoc comments for exported functions

**Example:**

```go
// GetUser retrieves a user by username.
// Returns an error if the user is not found.
func (s *Service) GetUser(username string) (*User, error) {
    // Implementation
}
```

**Error Handling:**
- Always handle errors explicitly
- Return descriptive error messages
- Use error wrapping for context

### General Guidelines

- **Write clear code**: Code should be self-documenting
- **Add comments**: Explain why, not what
- **Keep functions small**: Single responsibility principle
- **Use meaningful names**: Variables and functions should be descriptive
- **Avoid duplication**: DRY (Don't Repeat Yourself)
- **Test your code**: Write tests for new functionality

## Code Quality Checks

### Before Submitting

Ensure your code passes all quality checks:

```bash
# Frontend (pnpm, per package directory)
pnpm run lint
pnpm run format:check
pnpm run test

# Backend
go test ./...
go fmt ./...
go vet ./...
```

### CI/CD Checks

The CI pipeline automatically checks:

- Linting (ESLint for frontend)
- Formatting (Prettier for frontend, gofmt for backend)
- Tests (Jest for frontend, go test for backend)
- Build (ensures code compiles)

## Pull Request Guidelines

### PR Description

Include:

- **Summary**: Brief description of changes
- **Motivation**: Why this change is needed
- **Changes**: What was changed
- **Testing**: How it was tested
- **Screenshots**: If UI changes
- **Related Issues**: Link to related issues

### Review Process

- Maintainers will review your PR
- Address feedback promptly
- Be open to suggestions
- Keep discussions constructive

### After Approval

- Maintainers will merge your PR
- Your contribution will be included in the next release
- Thank you for contributing!

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Help

If you need help:

- Check the [documentation](/)
- Search [GitHub Issues](https://github.com/OpenDataEnsemble/ode/issues)
- Ask in [GitHub Discussions](https://github.com/OpenDataEnsemble/ode/discussions)
- Contact maintainers

## Recognition

Contributors are recognized in:

- GitHub contributors list
- Release notes
- Project documentation

Thank you for contributing to ODE!

## Related Documentation

- [Development Setup](/development/setup)
- [Building & Testing](/development/building-testing)
- [Architecture Overview](/development/architecture)
