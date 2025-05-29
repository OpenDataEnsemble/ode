# SyncPullResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**server_time** | **string** |  | [default to undefined]
**records** | [**Array&lt;Record&gt;**](Record.md) |  | [default to undefined]
**change_cutoff** | **number** |  | [default to undefined]
**next_page_token** | **string** |  | [optional] [default to undefined]
**has_more** | **boolean** |  | [optional] [default to undefined]

## Example

```typescript
import { SyncPullResponse } from './api';

const instance: SyncPullResponse = {
    server_time,
    records,
    change_cutoff,
    next_page_token,
    has_more,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
