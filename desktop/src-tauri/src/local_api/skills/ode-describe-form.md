---
name: ode-describe-form
description: Describe an ODE form in plain language — pages, questions, answer choices, required questions, skip logic, translations, version, and linked sub-forms. Use when the user asks what a form contains, how it works, or when a question is shown.
---

# Describe an ODE form

```sh
ode profiles list                                  # pick the profile (id or label)
ode forms list --profile <id>                      # find the form type
ode forms show <form_type> --profile <id>          # everything below comes from this
```

Run one command at a time. Don't use `--raw`: the field list has everything needed here.

## What the output means

- **Form-level:**
  - `title`, `version`;
  - `locales`: the languages the form is translated into;
  - `bundle`: `active` is the published bundle, `dev-local` is a local development copy.
- **Fields:** `fields` are listed in the order the questions appear. For each field:
  - `labels`: the question text. `default` is the base language, plus one entry per locale. If there are no labels, `title` is the question text.
  - `type`, `format`: for example `date`, `photo`, `sub-observation`, or `computed`.
  - `choices`: coded answers as value → label.
  - `required`: must be answered.
  - `page`, `group`: where the question sits.
  - `rules`: skip logic. `SHOW` means the question is shown only when `when` is true; `HIDE` means it's hidden when `when` is true. A rule with `on` comes from the page or group that contains the question.
  - `linkedForm`: the questions are a repeated sub-form, such as rooms in a household. Describe that form too if it matters.

## How to present it

1. One sentence on what the form is for (from the title and questions), plus its version and languages.
2. Go page by page, using group labels as headings. For each question give:
   - the label, in the user's language if a translation exists;
   - the type;
   - the choices. For long lists, give the count and a few examples.
3. Explain skip logic in words, with choice labels instead of codes. For example: "Asked only if _Does the household agree to take part?_ is _Yes_."
4. Point out:
   - required questions;
   - sub-forms;
   - fields with no `page`: they're stored but not asked, usually filled in by the app;
   - `computed` / read-only fields: calculated, not entered.

Don't invent behaviour that isn't in the output. If something is unclear, say so.
