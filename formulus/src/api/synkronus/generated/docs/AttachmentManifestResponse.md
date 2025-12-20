# AttachmentManifestResponse

## Properties

| Name                    | Type                                                                                        | Description                                        | Notes                             |
| ----------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| **current_version**     | **number**                                                                                  | Current database version number                    | [default to undefined]            |
| **operations**          | [**Array&lt;AttachmentOperation&gt;**](AttachmentOperation.md)                              | List of attachment operations to perform           | [default to undefined]            |
| **total_download_size** | **number**                                                                                  | Total size in bytes of all attachments to download | [optional] [default to undefined] |
| **operation_count**     | [**AttachmentManifestResponseOperationCount**](AttachmentManifestResponseOperationCount.md) |                                                    | [optional] [default to undefined] |

## Example

```typescript
import {AttachmentManifestResponse} from './api';

const instance: AttachmentManifestResponse = {
  current_version,
  operations,
  total_download_size,
  operation_count,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
