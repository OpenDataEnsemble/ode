# SyncPushRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**transmission_id** | **string** |  | [default to undefined]
**client_id** | **string** |  | [default to undefined]
**repository_generation** | **number** | Optional body copy of epoch; header x-repository-generation wins when both are sent. | [optional] [default to undefined]
**records** | [**Array&lt;Observation&gt;**](Observation.md) |  | [default to undefined]

## Example

```typescript
import { SyncPushRequest } from './api';

const instance: SyncPushRequest = {
    transmission_id,
    client_id,
    repository_generation,
    records,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
