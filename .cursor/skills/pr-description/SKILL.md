---
name: pr-description
description: >-
  Generates pull request description body in raw markdown using the ODE PR
  template. Use when the user asks for a PR description, types "/pr description"
  or "pr description", or wants copyable markdown for a PR body. Output is
  always in a fenced markdown code block for one-click copy.
---

# PR Description Generator

## When to use

Apply this skill when the user:

- Says **"/pr description"** or **"pr description"**
- Asks for **PR body**, **PR template**, or **copyable markdown for a PR**
- Wants to **fill out the PR template** for their changes

## What to do

1. **Infer scope** from the conversation or recent edits (e.g. which files changed, what type of change).
2. **Generate the PR body** using the ODE template below. Fill in Description, Type of Change, Component(s) Affected, Related Issue(s), Testing, Breaking Changes, Documentation, and Checklist based on context. Use `[x]` for checked items and `[ ]` for unchecked.
3. **Output only raw markdown** inside a single fenced code block (language `markdown`) so the user can copy it. The first line inside the fence should be `## Description` (or the first section heading)—no extra blank line before it.

4. **Do not** put a "# Pull Request Title" or title line in the body. Remind the user in one short sentence: *The PR title is set when you create the PR (e.g. in GitHub/GitLab); use Conventional Commits, e.g. `feat(docs): add X`.*

## ODE PR template (body only)

Use this structure. Replace placeholders and check the right boxes.

```markdown
## Description

<!-- Provide a clear description of what changed and why -->

## Type of Change

- [ ] Bug Fix
- [ ] New Feature / Enhancement
- [ ] Refactor / Code Cleanup
- [ ] Documentation Update
- [ ] Maintenance / Chore
- [ ] Other (please specify):

---

## Component(s) Affected

- [ ] **formulus** (React Native mobile app)
- [ ] **formulus-formplayer** (React web app)
- [ ] **synkronus** (Go backend server)
- [ ] **synkronus-cli** (Command-line utility)
- [ ] **Documentation**
- [ ] **DevOps / CI/CD**
- [ ] **Other:** <!-- Please specify -->

---

## Related Issue(s)

<!-- Use keywords: Closes #123, Fixes #456, Resolves #789 -->

**Closes/Fixes/Resolves:** <!-- e.g., Closes #123 -->

---

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manually tested
- [ ] Tested on multiple platforms (if applicable)
- [ ] Not applicable

---

## Breaking Changes

- [ ] This PR introduces breaking changes
- [ ] This PR does NOT introduce breaking changes

**If breaking changes, please describe migration steps:**

---

## Documentation Updates

- [ ] Documentation has been updated
- [ ] Documentation update is not required

---

## Checklist

- [ ] Code follows project style guidelines
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] PR title follows Conventional Commits format

---

**Thank you for contributing to Open Data Ensemble (ODE)!**
```

## Output rule

Always wrap the generated PR body in a **single** code block with language `markdown` so the user can copy the entire block and paste it into the PR description field. Do not add a heading above the code block like "Here's your PR body"—either output only the code block or one brief line before it (e.g. "Copy the markdown below into your PR description.").
