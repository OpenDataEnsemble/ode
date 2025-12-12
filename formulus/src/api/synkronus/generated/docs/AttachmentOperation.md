# AttachmentOperation

## Properties

| Name              | Type       | Description                                                            | Notes                             |
| ----------------- | ---------- | ---------------------------------------------------------------------- | --------------------------------- |
| **operation**     | **string** | Operation to perform on the attachment                                 | [default to undefined]            |
| **attachment_id** | **string** | Unique identifier for the attachment                                   | [default to undefined]            |
| **download_url**  | **string** | URL to download the attachment (only present for download operations)  | [optional] [default to undefined] |
| **size**          | **number** | Size of the attachment in bytes (only present for download operations) | [optional] [default to undefined] |
| **content_type**  | **string** | MIME type of the attachment (only present for download operations)     | [optional] [default to undefined] |
| **version**       | **number** | Version when this attachment was created/modified/deleted              | [optional] [default to undefined] |

## Example

```typescript
import {AttachmentOperation} from './api';

const instance: AttachmentOperation = {
  operation,
  attachment_id,
  download_url,
  size,
  content_type,
  version,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
