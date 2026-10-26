---
name: ode-describe-app
description: Give an overview of an ODE project (profile) — which forms it has, what each is for, how forms link to each other through sub-forms, and the state of its custom app. Use when the user asks what a project or app contains.
---

# Describe an ODE app / project

Run one command at a time:

```sh
ode profiles list
ode forms list --profile <id>
ode forms show <form_type> --profile <id>     # for each form
ode app status --profile <id>                 # works without extra permissions
```

Report:

1. **Profile:** the label, and which permissions agents have (`capabilities`). If `bundle` is `dev-local`, say that this is a local development copy, not the published bundle.
2. **Forms:** for each, give the title, version, number of questions, languages (`locales`), and a one-line purpose inferred from its questions.
3. **Structure:**
   - Fields with `linkedForm` make one form a sub-form of another, for example household → room → bed → person. Draw this as a short tree.
   - Forms that are only reached as sub-forms aren't started on their own.
4. **Custom app:** from `app status`, report the developer mode, the downloaded bundle version (`activeBundle`), and whether a server is configured.

Keep it short. Offer to describe any form in detail (skill `ode-describe-form`).
