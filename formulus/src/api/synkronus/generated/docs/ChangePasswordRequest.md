# ChangePasswordRequest

## Properties

| Name                | Type       | Description                       | Notes                  |
| ------------------- | ---------- | --------------------------------- | ---------------------- |
| **currentPassword** | **string** | Current password for verification | [default to undefined] |
| **newPassword**     | **string** | New password to set               | [default to undefined] |

## Example

```typescript
import {ChangePasswordRequest} from './api';

const instance: ChangePasswordRequest = {
  currentPassword,
  newPassword,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
