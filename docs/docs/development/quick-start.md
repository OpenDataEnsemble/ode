---
sidebar_position: 5
---

# Quick Start

Get up and running with ODE in approximately 15 minutes.

## Overview

This guide walks you through setting up a complete ODE environment and creating your first form.

## Step 1: Start Synkronus Server

Using Docker Compose is the fastest method:

```bash
# Clone the repository
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode/synkronus

# Start the server with Docker Compose
docker compose up -d
```

The server will be available at `http://localhost:8080`.

## Step 2: Install Formulus App

<Tabs>
  <TabItem value="android" label="Android">

Download and install the APK from the [releases page](https://github.com/OpenDataEnsemble/ode/releases), or build from source:

```bash
cd ode/packages/tokens && pnpm install && pnpm run build && cd ../..
cd ode/formulus
pnpm install
pnpm run android
```

  </TabItem>
  <TabItem value="ios" label="iOS">

Build from source (requires macOS and Xcode):

```bash
cd ode/packages/tokens && pnpm install && pnpm run build && cd ../..
cd ode/formulus
pnpm install
cd ios && bundle install && bundle exec pod install && cd ..
pnpm run ios
```

  </TabItem>
</Tabs>

## Step 3: Configure the App

1. Open the Formulus app
2. Navigate to Settings
3. Enter server URL: `http://your-server-ip:8080` (or `http://localhost:8080` for emulator)
4. Enter your credentials (create a user account first if needed)
5. Save the configuration

## Step 4: Create Your First Form

Forms are defined using JSON schema. Create a simple form:

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "Name"
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

Upload this form to your Synkronus server using the API or CLI tool.

## Step 5: Collect Data

1. Open the Formulus app
2. Navigate to your form
3. Fill out the form fields
4. Submit the observation
5. The data will be stored locally and synchronized to the server

## Step 6: Verify Data Collection

Check that your observation was created:

<Tabs>
  <TabItem value="curl" label="curl">

```bash
curl http://localhost:8080/api/observations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

  </TabItem>
  <TabItem value="cli" label="CLI">

```bash
synk observations list
```

  </TabItem>
  <TabItem value="portal" label="Portal">

1. Navigate to the Portal
2. Go to "Observations"
3. View your submitted observations

  </TabItem>
</Tabs>

## Next Steps

Now that you have a working setup:

- Learn about [form design](/guides/form-design) to create more complex forms
- Explore [custom applications](/guides/custom-applications) for specialized workflows
- Review the [API reference](/reference/api) for integration options
- Read about [synchronization](/using/synchronization) to understand data flow

## Troubleshooting

### Server Not Accessible

If the mobile app cannot connect to the server:

<Tabs>
  <TabItem value="physical" label="Physical Device">

Verify the server is running: `curl http://localhost:8080/health`

Check firewall settings

Use your machine's IP address: `http://192.168.1.100:8080`

Ensure device and server are on the same network

  </TabItem>
  <TabItem value="emulator" label="Android Emulator">

Use `10.0.2.2` instead of `localhost`: `http://10.0.2.2:8080`

Verify the server is running on the host machine

Check that port 8080 is accessible

  </TabItem>
  <TabItem value="simulator" label="iOS Simulator">

Use `localhost` or your machine's IP address: `http://localhost:8080`

Verify the server is running

Check firewall settings

  </TabItem>
</Tabs>

### Forms Not Appearing

If forms don't appear in the app:

- Verify the form was uploaded correctly
- Check that the app has synchronized with the server
- Review server logs for errors

### Synchronization Issues

If data is not synchronizing:

- Check network connectivity
- Verify authentication credentials
- Review server logs for sync errors
- Ensure the observation was saved locally before sync

## Related Documentation

- [Installation Guide](/docs/getting-started/installation)
- [Your First Form](/using/your-first-form)
- [Form Design Guide](/guides/form-design)

