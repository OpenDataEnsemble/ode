# Pull Request Title

<!-- 
  PR Title must follow Conventional Commits format:
  <type>(<scope>): <subject>
  
  Examples:
  - feat(auth): add OAuth2 login
  - fix(ui): resolve button alignment issue
  - docs: update installation guide
-->

## Type of Change

<!-- Select all that apply. See [Conventional Commits](CONTRIBUTING.md#commit-message-convention) for type definitions. -->

- [ ] Bug Fix
- [ ] New Feature / Enhancement
- [ ] Refactor / Code Cleanup
- [ ] Documentation Update
- [ ] Maintenance / Chore / Dependency Update
- [ ] CI/CD or Build System Update
- [ ] Security Fix
- [ ] Style / Formatting (no logic changes)
- [ ] Performance Improvement
- [ ] Test Addition / Update
- [ ] Revert
- [ ] Other (please specify):

---

## Component(s) Affected

<!-- Select one or more components. -->

- [ ] **formulus** ([React Native mobile app](formulus/README.md))
- [ ] **formulus-formplayer** ([React web app](formulus-formplayer/README.md))
- [ ] **synkronus** ([Go backend server](synkronus/README.md))
- [ ] **synkronus-cli** ([Command-line utility](synkronus-cli/README.md))
- [ ] **Documentation**
- [ ] **DevOps / CI/CD** ([CI/CD Documentation](.github/CICD.md))
- [ ] **Dependencies / Build System**
- [ ] **Other:** <!-- Please specify -->

---

## Related Issue(s)

<!-- 
  Link any relevant issues. Use keywords to auto-close:
  - Closes #123 (closes the issue when merged)
  - Fixes #456 (fixes the issue)
  - Resolves #789 (resolves the issue)
  - Refs #101 (references the issue)
  - Relates to #202 (related to the issue)
-->

**Closes/Fixes/Resolves:**
<!-- e.g., Closes #123 -->

**Related:**
<!-- e.g., Relates to #456, Refs #789 -->

---

## Description

<!-- 
  Provide a clear and concise description of WHAT changed.
  - What was added, removed, or modified?
  - What files were changed?
  - What functionality was affected?
-->

### Summary

<!-- Brief one-line summary -->

### Changes Made

<!-- Detailed list of changes -->

- 
- 
- 

---

## Rationale / Context

<!-- 
  Explain WHY the change was necessary.
  - What problem does it solve?
  - What benefit does it provide?
  - What was the motivation?
  - Are there any alternatives considered?
-->

**Problem:**
<!-- What issue or need does this address? -->

**Solution:**
<!-- How does this PR address the problem? -->

**Alternatives Considered:**
<!-- Were other approaches considered? Why was this chosen? -->

---

## Testing Instructions

<!-- 
  Provide clear, step-by-step instructions for reviewers to test this PR.
  Include any setup requirements, test data, or special conditions.
-->

### Prerequisites

<!-- Any setup needed before testing -->

- 
- 

### Steps to Test

1. 
2. 
3. 
4. 

### Expected Behavior

<!-- What should happen when testing? -->

### Test Coverage

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] End-to-end tests added/updated
- [ ] Manually tested on device(s) / browser(s)
- [ ] Tested on multiple platforms (iOS/Android/Web)
- [ ] Tested with different data sets
- [ ] Not applicable

### Test Results

<!-- If applicable, include test results or coverage reports -->

---

## Breaking Changes

<!-- 
  If this PR introduces breaking changes, clearly document:
  - What breaks?
  - Why is it necessary?
  - How to migrate?
-->

- [ ] This PR introduces breaking changes
- [ ] This PR does NOT introduce breaking changes

**If breaking changes, please describe:**

**Migration Steps:**
<!-- How should users update their code/config? See [Contributing Guide](CONTRIBUTING.md) for more information. -->

1. 
2. 
3. 

---

## Documentation Updates

- [ ] Documentation has been updated
- [ ] Documentation update is not required
- [ ] Documentation update will follow in a separate PR

**Files Updated:**
<!-- List documentation files that were modified (e.g., [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), component READMEs) -->

- 
- 

**New Documentation:**
<!-- List any new documentation added -->

- 
- 

---

## Screenshots / Videos

<!-- 
  Include screenshots or videos for:
  - UI/UX changes
  - Before/after comparisons
  - Error states
  - New features in action
  - Any visual changes
-->

### Before
<!-- Screenshot or description of previous state -->

### After
<!-- Screenshot or description of new state -->

---

## Performance Impact

<!-- 
  If applicable, describe any performance implications:
  - Performance improvements
  - Performance regressions
  - Memory usage changes
  - Database query optimizations
-->

- [ ] Performance improvement
- [ ] No performance impact
- [ ] Performance regression (explain below)

**Details:**
<!-- Describe performance changes, include benchmarks if available -->

---

## Security Considerations

<!-- 
  If applicable, describe any security implications:
  - New security features
  - Security fixes
  - Potential vulnerabilities addressed
  - Authentication/authorization changes
-->

- [ ] Security improvement
- [ ] Security fix
- [ ] No security impact

**Details:**
<!-- Describe security changes -->

---

## Checklist

<!-- 
  Please ensure all items are completed before requesting review.
  Check off items as you complete them.
-->

### Code Quality

- [ ] Code follows [project style guidelines](CONTRIBUTING.md#coding-standards)
- [ ] Code is self-documenting with clear variable/function names
- [ ] Comments added for complex logic
- [ ] No hardcoded values or magic numbers
- [ ] Error handling is appropriate

### Testing

- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Tests updated for changed functionality
- [ ] Manual testing completed
- [ ] Edge cases considered and tested

### Linting & Formatting

- [ ] Linting passes (`npm run lint` / `go fmt` / etc.)
- [ ] Code formatted according to [project standards](CONTRIBUTING.md#coding-standards)
- [ ] No console.log statements left in code
- [ ] No commented-out code blocks
- [ ] No unused imports or variables

### Git & PR Standards

- [ ] PR title follows [Conventional Commits format](CONTRIBUTING.md#commit-message-convention)
- [ ] Commit messages follow [Conventional Commits format](CONTRIBUTING.md#commit-message-convention)
- [ ] Branch naming follows [project conventions](CONTRIBUTING.md#branch-naming)
- [ ] Branch is up to date with `main` (or target branch)
- [ ] No merge conflicts
- [ ] Commits are logically organized
- [ ] All relevant labels added

### Documentation

- [ ] [README](README.md) updated (if applicable)
- [ ] Component-specific READMEs updated:
  - [ ] [formulus/README.md](formulus/README.md)
  - [ ] [formulus-formplayer/README.md](formulus-formplayer/README.md)
  - [ ] [synkronus/README.md](synkronus/README.md)
  - [ ] [synkronus-cli/README.md](synkronus-cli/README.md)
- [ ] Code comments added/updated
- [ ] [API documentation](synkronus/openapi/synkronus.yaml) updated (if applicable)
- [ ] [RELEASE.md](RELEASE.md) updated (if applicable)
- [ ] Migration guide added (for breaking changes)

### Review Readiness

- [ ] PR description is complete and clear
- [ ] All sections above are filled out
- [ ] Follows [Contributing Guide](CONTRIBUTING.md) standards
- [ ] Follows [Code of Conduct](CODE_OF_CONDUCT.md)
- [ ] Ready for review

---

## Additional Notes

<!-- 
  Any extra context, concerns, or information reviewers should know:
  - Known issues or limitations
  - Future work or follow-up tasks
  - Dependencies on other PRs
  - Special considerations
  - Questions for reviewers
-->

---

## Reviewer Notes

<!-- 
  For maintainers/reviewers:
  - Areas that need special attention
  - Suggested reviewers
  - Priority level
-->

**Suggested Reviewers:**
<!-- @mention specific reviewers if needed -->

**Priority:**
- [ ] Low
- [ ] Medium
- [ ] High
- [ ] Critical

---

## Related PRs

<!-- 
  Link to related PRs:
  - Depends on: #123
  - Blocks: #456
  - Related to: #789
-->

---

**Thank you for contributing to Open Data Ensemble (ODE)!**

