---
sidebar_position: 5
---

# Frequently Asked Questions

Common questions about ODE installation, usage, and development.

> **Current ODE release:** [v1.3.2](https://github.com/OpenDataEnsemble/ode/releases/tag/v1.3.2) (Synkronus container, Formulus, Desktop, CLI, Portal) · [Downloads](/downloads)

## General Questions

### How do you pronounce ODE?

ODE is pronounced like "code", without the "C."

### What is ODE?

Open Data Ensemble (ODE) is a platform for mobile data collection and synchronization. It provides tools for creating forms, collecting data offline, and synchronizing data across devices and servers.

### Is ODE free to use?

Yes, ODE is open source and free to use. The code is available under the MIT license.

### What platforms does ODE support?

ODE supports Android and iOS mobile devices. The server component runs on Linux, macOS, and Windows.

### Do I need internet connectivity to use ODE?

No, ODE is designed to work offline. Data is stored locally and synchronized when connectivity is available.

## Installation Questions

### What are the system requirements?

See the [Installation](/docs/getting-started/installation) page for detailed system requirements.

### Can I run ODE in the cloud?

Yes, ODE can be deployed to cloud platforms such as AWS, Google Cloud, or Azure. See the [Deployment guide](/docs/guides/deployment) and [Server Architecture for IT](/docs/guides/server-architecture-for-it).

### Do I need a database?

Yes, ODE requires PostgreSQL for data storage. The database schema is created automatically on first run.

## Usage Questions

### How do I create forms?

Forms are defined using JSON schema. See the [Form Design guide](/docs/guides/form-design) for details.

### Can I customize the user interface?

Yes, ODE supports custom applications and renderers. See [Custom Applications](/guides/custom-apps/overview) for details.

### How does synchronization work?

ODE uses a bidirectional sync protocol that pushes local data to the server and pulls new data from the server. See [Synchronization](/using/synchronization) for details.

### What happens if two devices modify the same data?

ODE automatically resolves conflicts using a version-based approach. The most recent version takes precedence.

## Development Questions

### How do I contribute to ODE?

See the [Contributing guide](/development/contributing/guide) for information on how to contribute.

### Can I extend ODE functionality?

Yes, ODE is designed to be extensible. See [Extending ODE](/development/extending/overview) for details.

### What programming languages are used?

ODE uses React Native for mobile apps, React for web components, and Go for the server.

## Troubleshooting

### The app won't connect to the server

- Verify the server is running and accessible
- Check the server URL in app settings
- Verify firewall and network settings
- For Android emulator, use `10.0.2.2` instead of `localhost`

### Forms are not appearing

- Verify forms were uploaded to the server
- Check that the app has synchronized
- Review server logs for errors

### Data is not synchronizing

- Check network connectivity
- Verify authentication credentials
- Review server logs for sync errors
- Ensure observations were saved locally

### Build errors

- Ensure all prerequisites are installed
- Check that dependencies are up to date
- Review error messages for specific issues
- See component-specific documentation for build instructions

## Getting Help

If you cannot find an answer to your question:

- Check the [Troubleshooting guide](/using/troubleshooting)
- Review the [API Reference](/reference/api/overview)
- Search [GitHub Issues](https://github.com/OpenDataEnsemble/ode/issues)
- Ask questions in the [Community section](/community/getting-help)

