---
sidebar_position: 3
---

# Key Concepts

Understanding these core concepts will help you work effectively with ODE.

## Core Concepts

### Forms

Forms are the primary mechanism for data collection in ODE. A form consists of:

- **Schema**: Defines the data structure and validation rules
- **UI Schema**: Defines how the form is presented to users
- **Question Types**: Define the input methods available (text, number, date, etc.)

Forms are defined using JSON and follow the JSON Forms specification. See the [Form Design guide](/guides/forms/overview) for details.

### Observations

An observation is a single data record collected through a form. Each observation contains:

- A unique identifier
- The form type used to collect it
- The data values entered by the user
- Metadata such as creation time and last modification time
- A sync status indicating whether it has been synchronized with the server

### Synchronization

Synchronization is the process of exchanging data between mobile devices and the server. ODE uses a bidirectional sync protocol that:

- Pushes local observations to the server
- Pulls new or updated observations from the server
- Resolves conflicts when the same observation is modified on multiple devices
- Handles attachments separately from observation metadata

See [Synchronization](/using/synchronization) for more details.

### App Bundles

An app bundle is a collection of resources that define a custom application. It includes:

- Custom HTML, CSS, and JavaScript files
- Form specifications
- Custom renderers for question types
- Configuration files

App bundles are uploaded to the server and downloaded by mobile devices during synchronization. See [Custom Applications](/guides/custom-apps/overview) for details.

### Custom Applications

Custom applications are web-based interfaces that run within the Formulus mobile app. They provide:

- Custom navigation and user interfaces
- Integration with the ODE form system
- Access to observation data through the Formulus JavaScript interface

Custom applications are defined in app bundles and can be tailored to specific use cases.

## Data Flow

The following diagram illustrates how data flows through the ODE system:

```
User Input → Form → Observation (Local) → Sync → Server → Database
                                                      ↓
                                              Sync → Other Devices
```

1. User fills out a form on a mobile device
2. An observation is created and stored locally
3. When connectivity is available, the observation is synchronized to the server
4. The server stores the observation in the database
5. Other devices can pull the observation during their sync operations

## Terminology

| Term | Definition |
|------|------------|
| **Form** | A data collection interface defined by schema and UI schema |
| **Observation** | A single data record collected through a form |
| **Schema** | JSON schema defining the structure and validation rules for a form |
| **UI Schema** | JSON schema defining the presentation of form fields |
| **Question Type** | A component that handles a specific type of input (text, number, etc.) |
| **Renderer** | A component that renders a question type in the form |
| **Sync** | The process of exchanging data between devices and server |
| **App Bundle** | A collection of resources defining a custom application |
| **Custom App** | A web-based application that runs within Formulus |
| **Formulus** | The mobile application component of ODE |
| **Synkronus** | The server component of ODE |
| **Formplayer** | The web-based form rendering component |

## Related Documentation

- [Form Design Guide](/guides/forms/overview)
- [Synchronization Details](/using/synchronization)
- [Custom Applications](/guides/custom-apps/overview)
- [Architecture Overview](/development/architecture/overview)

