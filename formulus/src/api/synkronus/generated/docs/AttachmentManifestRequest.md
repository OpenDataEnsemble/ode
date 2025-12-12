# AttachmentManifestRequest

## Properties

| Name              | Type       | Description                                                                      | Notes                  |
| ----------------- | ---------- | -------------------------------------------------------------------------------- | ---------------------- |
| **client_id**     | **string** | Unique identifier for the client requesting the manifest                         | [default to undefined] |
| **since_version** | **number** | Data version number from which to get attachment changes (0 for all attachments) | [default to undefined] |

## Example

```typescript
import {AttachmentManifestRequest} from './api';

const instance: AttachmentManifestRequest = {
  client_id,
  since_version,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
