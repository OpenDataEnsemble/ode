---
sidebar_position: 5
---

# Extending ODE

Guide to extending ODE functionality through custom renderers, plugins, and internal APIs.

## Overview

ODE is designed to be extensible. You can extend functionality through:

- **Custom Renderers**: Add new question types
- **Custom Applications**: Build specialized web applications
- **Internal APIs**: Extend server functionality (advanced)

## Custom Renderers

Custom renderers allow you to add new question types to the Formplayer.

### Implementation Steps

1. **Define Result Interface**

In `FormulusInterfaceDefinition.ts`:

```typescript
export interface MyCustomResultData {
  type: 'mycustom';
  value: string;
  timestamp: string;
}

export type MyCustomResult = ActionResult<MyCustomResultData>;
```

2. **Add Interface Method**

```typescript
export interface FormulusInterface {
  requestMyCustom(fieldId: string): Promise<MyCustomResult>;
}
```

3. **Create React Component**

Create `MyCustomQuestionRenderer.tsx`:

```typescript
import React, {useState, useCallback} from 'react';
import {withJsonFormsControlProps} from '@jsonforms/react';
import {FormulusClient} from './FormulusInterface';

const MyCustomQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const formulusClient = useRef(new FormulusClient());

  const handleAction = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await formulusClient.current.requestMyCustom(path);
      if (result.status === 'success') {
        handleChange(path, result.data.value);
      }
    } finally {
      setIsLoading(false);
    }
  }, [path, handleChange]);

  return (
    <Button onClick={handleAction} disabled={isLoading}>
      {isLoading ? 'Processing...' : 'Start Action'}
    </Button>
  );
};

export default withJsonFormsControlProps(MyCustomQuestionRenderer);
```

4. **Register Renderer**

In `App.tsx`:

```typescript
import MyCustomQuestionRenderer, {
  myCustomQuestionTester,
} from './MyCustomQuestionRenderer';

const customRenderers = [
  ...materialRenderers,
  {tester: myCustomQuestionTester, renderer: MyCustomQuestionRenderer},
];
```

5. **Add Mock Implementation**

For development testing, add mock support in `webview-mock.ts`.

6. **Implement Native Handler**

In Formulus React Native code, implement the native handler in `FormulusMessageHandlers.ts`.

See the [Form Design guide](/guides/form-design) for complete examples.

## Custom Applications

Custom applications are web-based interfaces that run within Formulus.

### Creating a Custom App

1. **Create HTML Structure**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Custom App</title>
  <script src="formulus-load.js"></script>
</head>
<body>
  <h1>My Custom App</h1>
  <script src="app.js"></script>
</body>
</html>
```

2. **Use Formulus API**

```javascript
async function init() {
  const api = await getFormulus();
  
  // Use API methods
  const forms = await api.getAvailableForms();
  // ...
}
```

3. **Package as App Bundle**

Create a ZIP file with:
- `index.html`
- `manifest.json`
- Assets (CSS, JS, images)

4. **Upload to Server**

```bash
synk app-bundle upload bundle.zip --activate
```

See the [Custom Applications guide](/guides/custom-applications) for details.

## Internal APIs

For advanced extensions, you can extend the server functionality.

### Adding New Endpoints

1. **Define Handler**

In `internal/handlers/`:

```go
func (h *Handler) MyNewEndpoint(w http.ResponseWriter, r *http.Request) {
    // Implementation
}
```

2. **Register Route**

In `internal/api/api.go`:

```go
r.Route("/my-endpoint", func(r chi.Router) {
    r.Get("/", h.MyNewEndpoint)
})
```

3. **Add Tests**

Create tests in `internal/handlers/`:

```go
func TestMyNewEndpoint(t *testing.T) {
    // Test implementation
}
```

### Adding New Services

1. **Create Service**

In `internal/services/`:

```go
type MyService struct {
    // Dependencies
}

func NewMyService(config *Config) (*MyService, error) {
    // Initialization
}
```

2. **Integrate with Handlers**

Pass service to handlers and use in endpoints.

## Best Practices

### Custom Renderers

- Follow existing renderer patterns
- Handle loading and error states
- Provide fallback options (manual input)
- Test thoroughly in mock and native environments

### Custom Applications

- Always use `getFormulus()` before accessing API
- Handle offline scenarios gracefully
- Optimize for mobile devices
- Test on actual devices

### Internal APIs

- Follow Go best practices
- Add comprehensive tests
- Document endpoints
- Consider backward compatibility

## Related Documentation

- [Form Design Guide](/guides/form-design)
- [Custom Applications Guide](/guides/custom-applications)
- [API Reference](/reference/api)
- [Architecture Overview](/development/architecture)
