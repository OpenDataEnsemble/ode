---
name: ode-describe-question
description: Explain one question (field) of an ODE form in depth — wording in each language, answer codes, when it is shown, which other questions depend on it, and where its answers are in exported data. Use when the user asks about a specific question or variable.
---

# Describe one question

```sh
ode forms show <form_type> --profile <id>
```

Find the field by `path`. The path is also the variable name in exports. If the user gives question text instead of a path, match it against `labels` and `title`.

Report:

1. **Wording:** every entry in `labels` (`default` plus each locale), or `title` if there are no labels.
2. **Answer type:** `type` / `format`, plus `choices` as a code → label table. Note that codes are what gets stored and exported, not the labels.
3. **When it's asked:**
   - Its `rules`, in plain language with choice labels. Mention rules inherited from its page or group (`on`).
   - Whether it's `required`.
   - Its `page` / `group`.
   - If it has no `page`, it's not asked; the app fills it in.
4. **What depends on it:** search the other fields' `rules[].when` for this path, and list those questions.
5. **In exported data:** column `data_<path>` in `<form_type>.parquet`. For a nested path `a.b`, the value is inside the JSON in column `data_a`. A `linkedForm` field refers to rows in that form's Parquet file.

When a question is hidden by a rule, its answer is cleared. A missing value can therefore mean "not asked" rather than "not answered".
