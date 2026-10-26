# Website manuscript: AI agent support

> For the website developer. This is suggested copy and structure for a landing section or page; adjust the tone and length to the site. Product facts are taken from the [AI agent support guide](../docs/guides/ai-agents.md). Please keep claims in line with it.

---

## Headline

**Collect offline. Analyze with AI.**

### Sub-headline

ODE keeps field data collection fully offline-first, and lets AI assistants you already use help with everything that happens afterwards: understanding forms, analysing data, and building the next version of your survey. You decide exactly what they're allowed to touch.

---

## Short pitch (2–3 sentences)

Your data collection app shouldn't need the cloud, and your analysis shouldn't need a week of reading form definitions. ODE Desktop connects AI assistants such as Claude, Cursor, Zed, VS Code, and Positron to your ODE projects through a local, permission-controlled tool. Agents can explain any form, export clean, self-documenting datasets, and draft form changes, which you preview and approve before anything reaches a device.

---

## Benefit blocks

### 1. Your forms, explained in seconds

Ask "When is the bed-net question shown?" and get a plain-language answer covering every page, question, answer code, translation, and skip-logic rule. No more digging through JSON.

### 2. Analysis-ready data, with the codebook included

Every export comes with Parquet files, ready-to-run scripts for R, Python, Stata, and Julia, and a machine-readable data dictionary. Your assistant knows what every column and code means from the first line of analysis.

### 3. Change surveys safely and fast

Describe the change ("add a consent question, and skip the household section if consent is refused"). The assistant edits the form, bumps its version, and checks it with ODE's validator. You preview it in ODE Desktop. Nothing is published without your confirmation.

### 4. Start a new project in minutes

Go from a fresh ODE Desktop install to a working custom app with an example form, built on the official open-source template, guided step by step by your assistant.

---

## Privacy by design

**You stay in control. Always.**

- **Off by default:** agents can read form definitions, but collected data, app changes, and publishing are separate switches, all off by default, set per project.
- **Enforced by ODE, not by the AI:** permissions are checked by ODE itself. They don't depend on the assistant following instructions.
- **Local first:** ODE Desktop doesn't send your data to any AI service. Your assistant only sees what you allow it to read.
- **Credentials never shared:** passwords and tokens stay in ODE Desktop.

Suggested visual: a simple panel of four switches (form definitions ✅ · data ⬜ · manage app ⬜ · publish ⬜) next to an assistant chat bubble.

---

## Call to action

**Try it with your own project.** Download ODE Desktop, open *Profiles → Local tools*, and click *Copy initial prompt for AI assistant*.

Buttons: [Download ODE Desktop] · [Read the AI agent guide]

---

## Notes for the website developer

- "AI agents" means AI coding and analysis assistants running on the user's computer. ODE doesn't ship its own AI model, and doesn't require one for data collection.
- Avoid claims about specific AI providers' privacy practices; link to the guide instead.
- **Next manuscripts:**
  - **Formulus profiles:** several projects or servers in one mobile app, with separate data per profile.
  - **iOS support.**

  Together with AI agent support, these are strong differentiators.
- **Proposed feature comparison table:** ODE vs REDCap, ODK / ODK-X, DHIS2 Capture, and others. Rows could be:
  - offline-first data collection;
  - iOS and Android apps;
  - multiple projects/profiles in one mobile app;
  - custom apps (HTML/JS) on top of forms;
  - self-hosted server;
  - open source licence;
  - AI agent integration with per-project permissions;
  - Parquet export with a data dictionary.

  **Every competitor cell must be verified against that product's current official documentation before publishing**, and dated ("as of …").
