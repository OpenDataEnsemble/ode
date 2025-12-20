# SyncPullRequest

## Properties

| Name             | Type                                                | Description | Notes                             |
| ---------------- | --------------------------------------------------- | ----------- | --------------------------------- |
| **client_id**    | **string**                                          |             | [default to undefined]            |
| **since**        | [**SyncPullRequestSince**](SyncPullRequestSince.md) |             | [optional] [default to undefined] |
| **schema_types** | **Array&lt;string&gt;**                             |             | [optional] [default to undefined] |

## Example

```typescript
import {SyncPullRequest} from './api';

const instance: SyncPullRequest = {
  client_id,
  since,
  schema_types,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
