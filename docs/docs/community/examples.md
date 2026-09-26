---
sidebar_position: 2
---

# Examples

Example ODE applications, forms, and configurations to help you get started.

## Form Examples

### Basic Survey Form

A simple form collecting name and age:

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "Full Name"
    },
    "age": {
      "type": "integer",
      "title": "Age",
      "minimum": 0,
      "maximum": 120
    }
  },
  "required": ["name", "age"]
}
```

### Health Survey Form

Example health survey form collecting patient information:

```json
{
  "type": "object",
  "properties": {
    "patientId": {
      "type": "string",
      "title": "Patient ID"
    },
    "visitDate": {
      "type": "string",
      "format": "date",
      "title": "Visit Date"
    },
    "symptoms": {
      "type": "array",
      "title": "Symptoms",
      "items": {
        "type": "string",
        "enum": ["fever", "cough", "headache", "fatigue"]
      }
    },
    "temperature": {
      "type": "number",
      "title": "Temperature (°C)",
      "minimum": 35,
      "maximum": 42
    },
    "notes": {
      "type": "string",
      "title": "Clinical Notes"
    }
  },
  "required": ["patientId", "visitDate"]
}
```

### Research Data Collection Form

Example research form for field data collection:

```json
{
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "title": "Site ID"
    },
    "location": {
      "type": "string",
      "format": "gps",
      "title": "Site Location"
    },
    "sitePhoto": {
      "type": "object",
      "format": "photo",
      "title": "Site Photo"
    },
    "observations": {
      "type": "string",
      "title": "Field Observations"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "title": "Observation Time"
    }
  },
  "required": ["siteId", "location"]
}
```

## Custom Application Examples

### Basic Custom App

Simple custom application that lists available forms:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Form Selector</title>
  <script src="formulus-load.js"></script>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .form-list { list-style: none; padding: 0; }
    .form-item { padding: 10px; margin: 5px 0; background: #f5f5f5; cursor: pointer; }
    .form-item:hover { background: #e0e0e0; }
  </style>
</head>
<body>
  <h1>Available Forms</h1>
  <ul id="formList" class="form-list"></ul>
  
  <script>
    async function init() {
      const api = await getFormulus();
      const forms = await api.getAvailableForms();
      
      const list = document.getElementById('formList');
      forms.forEach(form => {
        const item = document.createElement('li');
        item.className = 'form-item';
        item.textContent = form.name;
        item.onclick = () => api.addObservation(form.type, {});
        list.appendChild(item);
      });
    }
    
    init();
  </script>
</body>
</html>
```

### Advanced Custom App

Advanced custom applications can include complex workflows, custom navigation, and integration with external systems. Examples of advanced patterns will be added as they become available. For now, see the [Custom Applications guide](/guides/custom-applications) for detailed implementation guidance.

## Configuration Examples

### Server Configuration

Example server configuration for development:

```bash
PORT=8080
DB_CONNECTION=postgres://synkronus:password@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=your-secret-key-change-this-in-production
LOG_LEVEL=debug
APP_BUNDLE_PATH=./data/app-bundles
MAX_VERSIONS_KEPT=5
```

### Docker Compose Configuration

Example Docker Compose configuration for production:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data

  synkronus:
    image: ghcr.io/opendataensemble/synkronus:latest
    environment:
      DB_CONNECTION: postgres://synkronus:${DB_PASSWORD}@postgres:5432/synkronus?sslmode=disable
      JWT_SECRET: ${JWT_SECRET}
      LOG_LEVEL: info
    depends_on:
      - postgres
    volumes:
      - app-bundles:/app/data/app-bundles

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - synkronus

volumes:
  postgres-data:
  app-bundles:
```

## Integration Examples

### API Integration

Example API integration using different methods:

<Tabs>
  <TabItem value="curl" label="curl">

```bash
# Authenticate
TOKEN=$(curl -X POST http://your-server:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}' \
  | jq -r '.token')

# Pull data
curl -X POST http://your-server:8080/sync/pull \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"my-client","since_change_id":0}'

# Push data
curl -X POST http://your-server:8080/sync/push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transmission_id": "550e8400-e29b-41d4-a716-446655440000",
    "client_id": "my-client",
    "records": [...]
  }'
```

  </TabItem>
  <TabItem value="cli" label="CLI">

```bash
# Login (stores token automatically)
synk login --username user

# Pull data
synk sync pull data.json --client-id my-client

# Push data
synk sync push data.json
```

  </TabItem>
  <TabItem value="python" label="Python">

```python
import requests

# Authenticate
response = requests.post(
    'http://your-server:8080/auth/login',
    json={'username': 'user', 'password': 'pass'}
)
token = response.json()['token']

# Pull data
response = requests.post(
    'http://your-server:8080/sync/pull',
    headers={'Authorization': f'Bearer {token}'},
    json={'client_id': 'my-client', 'since_change_id': 0}
)
data = response.json()
```

  </TabItem>
</Tabs>

### Data Export Examples

Export observations using different methods:

<Tabs>
  <TabItem value="cli" label="CLI">

```bash
# Export all observations
synk data export observations.zip

# Export to specific directory
synk data export ./backups/observations_$(date +%Y%m%d).zip

# Export to JSON
synk data export observations.json --format json
```

  </TabItem>
  <TabItem value="curl" label="curl">

```bash
# Export to Parquet ZIP
curl -X GET http://your-server:8080/api/dataexport/parquet \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o observations.zip
```

  </TabItem>
  <TabItem value="portal" label="Portal">

1. Navigate to the Portal
2. Go to "Data Export"
3. Select format (Parquet, JSON, CSV)
4. Click "Export" to download

  </TabItem>
</Tabs>

The exported ZIP contains Parquet files organized by schema type, suitable for analysis in tools like Python pandas, R, or data analysis platforms.

## Community Projects

Projects built by the ODE community will be showcased here as they become available.

## Contributing Examples

If you have examples you'd like to share, please:

1. Create a pull request with your example
2. Include clear documentation
3. Follow the existing example format
4. Ensure examples are tested and working

## Related Resources

- [Form Design Guide](/guides/form-design)
- [Custom Applications Guide](/guides/custom-applications)
- [API Reference](/reference/api)
- [Getting Help](/community/getting-help)
