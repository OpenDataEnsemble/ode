# Observation

## Properties

| Name               | Type                                                    | Description                                | Notes                             |
| ------------------ | ------------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| **observation_id** | **string**                                              |                                            | [default to undefined]            |
| **form_type**      | **string**                                              |                                            | [default to undefined]            |
| **form_version**   | **string**                                              |                                            | [default to undefined]            |
| **data**           | **object**                                              | Arbitrary JSON object containing form data | [default to undefined]            |
| **created_at**     | **string**                                              |                                            | [default to undefined]            |
| **updated_at**     | **string**                                              |                                            | [default to undefined]            |
| **synced_at**      | **string**                                              |                                            | [optional] [default to undefined] |
| **deleted**        | **boolean**                                             |                                            | [default to undefined]            |
| **geolocation**    | [**ObservationGeolocation**](ObservationGeolocation.md) |                                            | [optional] [default to undefined] |

## Example

```typescript
import {Observation} from './api';

const instance: Observation = {
  observation_id,
  form_type,
  form_version,
  data,
  created_at,
  updated_at,
  synced_at,
  deleted,
  geolocation,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
