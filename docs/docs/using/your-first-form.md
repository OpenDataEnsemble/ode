---
sidebar_position: 2
---

# Your First Form

This guide walks you through creating and submitting your first form using ODE.

## Prerequisites

Before starting, ensure you have:

- Formulus app installed and configured
- Synkronus server running and accessible
- App connected to the server

## Creating a Form

Forms in ODE are defined using JSON schema. A basic form consists of a schema definition and optionally a UI schema.

### Basic Form Example

Here's a simple form that collects a name and age:

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

### Uploading the Form

Upload the form to your Synkronus server using one of these methods:

<Tabs>
  <TabItem value="curl" label="curl">

```bash
curl -X POST http://your-server:8080/api/formspecs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "formType": "basic-survey",
    "version": "1.0.0",
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string", "title": "Full Name"},
        "age": {"type": "integer", "title": "Age", "minimum": 0, "maximum": 120}
      },
      "required": ["name", "age"]
    }
  }'
```

  </TabItem>
  <TabItem value="cli" label="CLI">

```bash
# Create a form specification file (form.json)
synk formspec create form.json --form-type basic-survey --version 1.0.0
```

  </TabItem>
  <TabItem value="portal" label="Portal">

1. Navigate to the Portal
2. Go to "Form Specifications"
3. Click "Create New Form"
4. Enter form type and version
5. Paste or upload your JSON schema
6. Click "Save"

  </TabItem>
</Tabs>

## Filling Out the Form

1. Open the Formulus app on your device
2. Navigate to the forms list
3. Select your form from the list
4. Fill out the form fields
5. Review your entries
6. Submit the form

## Submitting Observations

When you submit a form, an observation is created. The observation contains:

- The form data you entered
- Metadata such as creation timestamp
- A unique identifier
- Sync status

Observations are stored locally on your device and synchronized to the server when connectivity is available.

## Verifying Submission

To verify that your observation was created:

1. Check the app's observation list
2. Verify the observation appears with a "synced" status after synchronization
3. Query the server API to confirm the observation was received

## Next Steps

- Learn about [form design](/guides/forms/overview) to create more complex forms
- Explore [data management](/using/data-management) features
- Understand [synchronization](/using/synchronization) in detail

