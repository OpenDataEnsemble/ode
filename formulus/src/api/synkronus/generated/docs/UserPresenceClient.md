# UserPresenceClient

## Properties

| Name                 | Type       | Description                                               | Notes                             |
| -------------------- | ---------- | --------------------------------------------------------- | --------------------------------- |
| **clientId**         | **string** | Client id from sync or empty string when unknown          | [default to undefined]            |
| **lastSeenAt**       | **string** |                                                           | [default to undefined]            |
| **lastDataVersion**  | **number** | Last known sync data version cursor hint for this client  | [optional] [default to undefined] |
| **appBundleVersion** | **string** |                                                           | [optional] [default to undefined] |
| **lastOdeVersion**   | **string** | ODE/Formulus client version header last seen for this row | [optional] [default to undefined] |

## Example

```typescript
import { UserPresenceClient } from './api';

const instance: UserPresenceClient = {
  clientId,
  lastSeenAt,
  lastDataVersion,
  appBundleVersion,
  lastOdeVersion,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
