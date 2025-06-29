# SyncPullResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**current_version** | **number** | Current database version number that increments with each update | [default to undefined]
**records** | [**Array&lt;Observation&gt;**](Observation.md) |  | [default to undefined]
**change_cutoff** | **number** | Version number of the last change included in this response | [default to undefined]
**next_page_token** | **string** |  | [optional] [default to undefined]
**has_more** | **boolean** |  | [optional] [default to undefined]
**sync_format_version** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { SyncPullResponse } from './api';

const instance: SyncPullResponse = {
    current_version,
    records,
    change_cutoff,
    next_page_token,
    has_more,
    sync_format_version,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
