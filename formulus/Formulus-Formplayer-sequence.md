# Formulus <-> Formplayer Communication

## Simplified Sequence Diagram

```mermaid
sequenceDiagram
    participant Formulus as Formulus (Android RN)
    participant Formplayer as Formplayer (WebView JS)

    Formulus->>Formplayer: Inject JS interface
    Formplayer->>Formulus: initForm()
    Formulus-->>Formplayer: {formId, params, savedData}
    Note right of Formplayer: Formplayer renders form UI

    Formplayer->>Formulus: savePartial(formId, data)
    Note right of Formplayer: Called on change/autosave

    Formplayer->>Formulus: submitForm(formId, finalData)
    Note right of Formplayer: Called on form completion

    Formulus->>Formplayer: Close form view
```


## Canonical Sequence Diagram
```mermaid
sequenceDiagram
    participant Formplayer as Formplayer (WebView JS)
    participant Formulus as Formulus (React Native)

    %% Initialization
    Formplayer->>Formulus: initForm()
    Formulus-->>Formplayer: { formId, params, savedData }

    %% Form interaction
    Formplayer->>Formulus: savePartial(formId, data)

    %% Native feature calls (can happen anytime)
    alt Camera
        Formplayer->>Formulus: requestCamera(fieldId)
        Formulus->>Formulus: Open camera
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "image", uri })
    end

    alt Location
        Formplayer->>Formulus: requestLocation(fieldId)
        Formulus->>Formulus: Get GPS coords
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "location", coords })
    end

    alt File Picker
        Formplayer->>Formulus: requestFile(fieldId)
        Formulus->>Formulus: Open file picker
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "file", uri })
    end

    alt Android Intent
        Formplayer->>Formulus: launchIntent(fieldId, intentSpec)
        Formulus->>Formulus: Start intent activity
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "intent", data })
    end

    alt Subform
        Formplayer->>Formulus: callSubform(fieldId, formId, options)
        Formulus->>Formulus: Open subform view
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "subform", data })
    end

    alt Audio Recording
        Formplayer->>Formulus: requestAudio(fieldId)
        Formulus->>Formulus: Record audio
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "audio", uri })
    end

    alt Signature
        Formplayer->>Formulus: requestSignature(fieldId)
        Formulus->>Formulus: Capture signature
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "signature", image })
    end

    alt Biometric Auth
        Formplayer->>Formulus: requestBiometric(fieldId)
        Formulus->>Formulus: Trigger biometric
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "biometric", verified })
    end

    alt Connectivity Status
        Formplayer->>Formulus: requestConnectivityStatus()
        Formulus->>Formulus: Check network
        Formulus->>Formplayer: onAttachmentReady({ type: "connectivity", status })
    end

    alt Sync Info
        Formplayer->>Formulus: requestSyncStatus()
        Formulus->>Formulus: Get sync info
        Formulus->>Formplayer: onAttachmentReady({ type: "sync", progress })
    end

    alt Run ML Model
        Formplayer->>Formulus: runLocalModel(fieldId, modelId, input)
        Formulus->>Formulus: Run model
        Formulus->>Formplayer: onAttachmentReady({ fieldId, type: "ml_result", result })
    end

    %% Submission
    Formplayer->>Formulus: submitForm(formId, finalData)
    Formulus->>Formplayer: Close form view
```

### Components

```mermaid
graph TD
    %% Formplayer App Components
    subgraph "Formplayer App"
        FPC["FormulusClient"] --> FPI["globalThis.formulus Interface"] 
        FPW["Formplayer WebView"] --> FPC
    end
    
    %% Formulus App Components
    subgraph "Formulus App"
        FPM["FormplayerModal Component"] --> WV["WebView"] 
        WV --> IJI["Injected JavaScript Interface"]
        IJI --> RNMH["React Native Message Handlers"]
        RNMH --> NC["Native Code (Kotlin/Java)"]
    end
    
    %% Communication between apps
    FPI <-->|"postMessage()"| IJI
    
    %% Styling
    classDef formplayer fill:#f9f,stroke:#333,stroke-width:2px
    classDef formulus fill:#bbf,stroke:#333,stroke-width:2px
    class FPC,FPI,FPW formplayer
    class FPM,WV,IJI,RNMH,NC formulus
```

#### Component Descriptions

1. **FormulusClient** - TypeScript client used by the formplayer app to communicate with Formulus
2. **globalThis.formulus Interface** - JavaScript interface injected into the WebView
3. **Formplayer WebView** - The WebView running the formplayer app
4. **FormplayerModal Component** - React Native component that creates and manages the WebView
5. **WebView** - The React Native WebView component
6. **Injected JavaScript Interface** - The JavaScript code injected into the WebView
7. **React Native Message Handlers** - Code that processes messages from the WebView
8. **Native Code** - Kotlin/Java code for native features (camera, location, etc.)
