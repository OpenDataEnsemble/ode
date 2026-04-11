# SyncPullRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**client_id** | **string** |  | [default to undefined]
**repository_generation** | **number** | Optional body copy of epoch; header x-repository-generation wins when both are sent. | [optional] [default to undefined]
**since** | [**SyncPullRequestSince**](SyncPullRequestSince.md) |  | [optional] [default to undefined]
**schema_types** | **Array&lt;string&gt;** |  | [optional] [default to undefined]

## Example

```typescript
import { SyncPullRequest } from './api';

const instance: SyncPullRequest = {
    client_id,
    repository_generation,
    since,
    schema_types,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
