# UserPresenceSummary


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**lastSeenAt** | **string** | Latest activity across all clients for this user | [optional] [default to undefined]
**clientCount** | **number** | Number of distinct client ids seen | [optional] [default to undefined]
**clients** | [**Array&lt;UserPresenceClient&gt;**](UserPresenceClient.md) |  | [optional] [default to undefined]

## Example

```typescript
import { UserPresenceSummary } from './api';

const instance: UserPresenceSummary = {
    lastSeenAt,
    clientCount,
    clients,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
