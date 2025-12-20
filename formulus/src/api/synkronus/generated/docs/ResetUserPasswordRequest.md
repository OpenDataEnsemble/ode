# ResetUserPasswordRequest

## Properties

| Name            | Type       | Description                                        | Notes                  |
| --------------- | ---------- | -------------------------------------------------- | ---------------------- |
| **username**    | **string** | Username of the user whose password is being reset | [default to undefined] |
| **newPassword** | **string** | New password for the user                          | [default to undefined] |

## Example

```typescript
import {ResetUserPasswordRequest} from './api';

const instance: ResetUserPasswordRequest = {
  username,
  newPassword,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
