# SystemVersionInfo

## Properties

| Name         | Type                                | Description | Notes                             |
| ------------ | ----------------------------------- | ----------- | --------------------------------- |
| **server**   | [**ServerInfo**](ServerInfo.md)     |             | [optional] [default to undefined] |
| **database** | [**DatabaseInfo**](DatabaseInfo.md) |             | [optional] [default to undefined] |
| **system**   | [**SystemInfo**](SystemInfo.md)     |             | [optional] [default to undefined] |
| **build**    | [**BuildInfo**](BuildInfo.md)       |             | [optional] [default to undefined] |

## Example

```typescript
import {SystemVersionInfo} from './api';

const instance: SystemVersionInfo = {
  server,
  database,
  system,
  build,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
