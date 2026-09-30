---
sidebar_position: 3
title: 📋 For Implementers
---

# Form Design & Project Implementation

Welcome to the **Implementer** section! Whether you're a form designer, project manager, or NGO leader, this guide covers everything you need to design forms, manage projects, and deploy ODE in your organization.

## Who This Guide Is For

This section is designed for users who:

- Are designing data collection forms
- Are planning and managing ODE projects
- Want to customize forms for specific workflows
- Need guidance on deployment and data management
- Are responsible for project outcomes

:::tip AI coding assistants
If you use an AI assistant to build **custom applications** (bundles and JSON forms) for ODE, see **[custom_app](https://github.com/OpenDataEnsemble/custom_app)** on GitHub and the **[documentation](https://opendataensemble.org/docs/)** site—no need to clone the full ODE monorepo.
:::

:::info Not collecting data?
If you're collecting data with Formulus, see the [Data Collector Guide](/docs/collector/collector-index).  
If you're developing or extending ODE, see the [Developer Guide](/docs/developer/developer-index).
:::

## Quick Start

Get your first form running in 30 minutes:

1. **[Understand the Basics](/docs/implementer/implementer-overview)** - Learn how forms and projects work
2. **[Design Your First Form](/docs/guides/form-design)** - Create a form using JSON schema
3. **[Deploy Your Form](/docs/guides/deployment)** - Get it to field workers

## What You'll Learn

<div className="row">
  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>Implementer Overview</h4>
      </div>
      <div className="card__body">
        <p>Understand your role and project planning basics.</p>
        <a className="button button--primary button--sm button--block" href="/docs/implementer/implementer-overview">Get Started →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>Form Design Guide</h4>
      </div>
      <div className="card__body">
        <p>Master JSON schema and UI design patterns.</p>
        <a className="button button--primary button--sm button--block" href="/docs/guides/form-design">Learn More →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>ODE Desktop</h4>
      </div>
      <div className="card__body">
        <p>Desktop app for data stewardship and app bundle development (v1.1.0+).</p>
        <a className="button button--primary button--sm button--block" href="/docs/using/ode-desktop/">User Guide →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>ODE Desktop developer mode</h4>
      </div>
      <div className="card__body">
        <p>Test a local custom app build in the Workbench against real profile data.</p>
        <a className="button button--primary button--sm button--block" href="/docs/guides/ode-desktop-developer-mode">Learn More →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>JSON Forms Reference</h4>
      </div>
      <div className="card__body">
        <p>Complete reference for form controls and validation.</p>
        <a className="button button--primary button--sm button--block" href="/docs/reference/formplayer">Reference →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>Deployment Guide</h4>
      </div>
      <div className="card__body">
        <p>Steps to deploy forms to field teams.</p>
        <a className="button button--primary button--sm button--block" href="/docs/guides/deployment">Deploy →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>Data Management</h4>
      </div>
      <div className="card__body">
        <p>Collect, review, and export data securely.</p>
        <a className="button button--primary button--sm button--block" href="/docs/using/data-management">Learn More →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>Troubleshooting</h4>
      </div>
      <div className="card__body">
        <p>Fix issues with forms, sync, or deployment.</p>
        <a className="button button--primary button--sm button--block" href="/docs/using/troubleshooting">Get Help →</a>
      </div>
    </div>
  </div>
</div>

## Documentation Roadmap

### 🎓 Learn the Concepts
- [Implementer Role Overview](/docs/implementer/implementer-overview)
- [How ODE Works](/docs/implementer/implementer-overview#how-ode-works)
- [Project Planning Checklist](/docs/implementer/implementer-overview#project-planning)

### Design Forms
- [Form Design Principles](/docs/guides/form-design)
- [JSON Schema Basics](/docs/guides/form-design#json-schema)
- [UI Schema for User Experience](/docs/guides/form-design#ui-schema)
- [Form Controls Reference](/docs/reference/formplayer)
- [Validation Rules](/docs/guides/form-design#validation)

### Advanced Form Features
- [Conditional Fields](/docs/guides/form-design#conditional-logic)
- [Choice lists (shared + dynamic)](/docs/guides/choice-lists)
- [Observation queries & indexes](/docs/guides/observation-queries)
- [Media Capture (Photos, Audio)](/docs/guides/form-design#media)
- [Calculated Fields](/docs/guides/form-design#calculations)

### Deployment & Operations
- [Deployment Planning](/docs/guides/deployment)
- [Creating App Bundles](/docs/using/app-bundles)
- [User Management](/docs/guides/deployment#user-management)
- [Monitoring Form Submissions](/docs/using/data-management#monitoring)

### Data Management
- [Understanding Data Structure](/docs/using/data-management)
- [Exporting Data](/docs/using/data-management#export)
- [Data Quality & Validation](/docs/using/data-management#quality)
- [Archiving Old Data](/docs/using/data-management#archiving)

### 🔧 Configuration
- [Server Configuration](/docs/reference/configuration/server)
- [Client Configuration](/docs/reference/configuration/client)
- [App Bundle Format](/docs/reference/app-bundle-format)

## Key Concepts

### The ODE Workflow

```
1. Design Forms (You)
   ↓
2. Create Project (Server Setup)
   ↓
3. Distribute App (Field Teams)
   ↓
4. Collect Data (Workers)
   ↓
5. Sync to Server (Automatic)
   ↓
6. Review & Export (You)
   ↓
7. Analyze Data (Your Tools)
```

### Form Design Philosophy

ODE forms are **JSON-based**, which means:
- ✅ Forms are portable (no proprietary format)
- ✅ Forms are version-controlled (git-friendly)
- ✅ Forms are human-readable
- ✅ Forms support complex validation
- ✅ Forms work offline seamlessly

### Your Responsibilities

As an Implementer, you typically:

| Task | When | Tool |
|------|------|------|
| Design forms | Project planning phase | JSON editor + ODE reference |
| Create app bundle | Before deployment | Synkronus CLI or portal |
| Distribute to workers | Pre-launch | Formulus app or direct installation |
| Monitor submissions | During collection | Synkronus portal |
| Export data | After collection | Synkronus CLI or custom scripts |
| Review quality | Ongoing | Your analysis tools |

## Common Scenarios

### Scenario 1: Health Survey
You're conducting a community health survey with 50 field workers across a region with limited connectivity.

→ [See the Health Survey Template Guide](/docs/guides/form-design#health-survey-example)

### Scenario 2: Multi-Form Campaign
You're managing a 3-form workflow where later forms depend on earlier responses.

→ [See Forms with Conditional Logic](/docs/guides/form-design#conditional-logic)

### Scenario 3: Offline Deployment
You need workers to collect data with zero internet connectivity for extended periods.

→ [See Offline Deployment Guide](/docs/guides/deployment#offline)

### Scenario 4: Large-Scale Rollout
You're deploying to 1000+ workers across multiple countries.

→ [See Scaling & Infrastructure](/docs/guides/deployment#scale)

## Terminology

| Term | Meaning |
|------|---------|
| **Form** | A survey/questionnaire defined in JSON |
| **Project** | A collection of forms and workers under one management |
| **App Bundle** | A packaged set of forms distributed to workers |
| **Submission** | One completed form response |
| **Sync** | Sending submissions from device to server |
| **Formular** | The mobile app workers use |
| **Synkronus** | The server storing data |
| **UI Schema** | Instructions for how to display a form |
| **Validation** | Rules that check if data is correct |

## Before You Start

You should have:

- ✅ Understanding of your data collection workflow
- ✅ List of form fields needed
- ✅ Access to ODE server (or instructions for setup)
- ✅ Basic familiarity with JSON (or willingness to learn)
- ✅ Access to your field team for testing

## Getting Help

If you need assistance:

1. **Check the form design guide** → [Form Design Guide](/docs/guides/form-design)
2. **Look up a control type** → [Form Controls Reference](/docs/reference/formplayer)
3. **Review deployment steps** → [Deployment Guide](/docs/guides/deployment)
4. **Contact the community** → [Get Help](/docs/community/getting-help)
5. **Report an issue** → [GitHub Issues](https://github.com/OpenDataEnsemble/ode)

## Next Steps

Ready to start designing? Let's begin!

→ **[Implementer Overview](/docs/implementer/implementer-overview)**

Or jump straight to form design:

→ **[Form Design Guide](/docs/guides/form-design)**

---

:::note Tips
- Start with a simple form to test your workflow
- Involve your field team in form design (they know what works)
- Plan for data quality checks from the beginning
- Test in offline mode before large-scale rollout
:::
