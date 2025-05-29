# SyncPushResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**server_time** | **string** |  | [default to undefined]
**success_count** | **number** |  | [default to undefined]
**failed_records** | **Array&lt;object&gt;** |  | [optional] [default to undefined]
**warnings** | [**Array&lt;SyncPushResponseWarningsInner&gt;**](SyncPushResponseWarningsInner.md) |  | [optional] [default to undefined]

## Example

```typescript
import { SyncPushResponse } from './api';

const instance: SyncPushResponse = {
    server_time,
    success_count,
    failed_records,
    warnings,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
