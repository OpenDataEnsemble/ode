# Observation

## Properties

| Name               | Type                                                    | Description                                                            | Notes                             |
| ------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| **observation_id** | **string**                                              |                                                                        | [default to undefined]            |
| **form_type**      | **string**                                              |                                                                        | [default to undefined]            |
| **form_version**   | **string**                                              |                                                                        | [default to undefined]            |
| **data**           | **object**                                              | Arbitrary JSON object containing form data                             | [default to undefined]            |
| **created_at**     | **string**                                              |                                                                        | [default to undefined]            |
| **updated_at**     | **string**                                              |                                                                        | [default to undefined]            |
| **synced_at**      | **string**                                              |                                                                        | [optional] [default to undefined] |
| **deleted**        | **boolean**                                             |                                                                        | [default to undefined]            |
| **geolocation**    | [**ObservationGeolocation**](ObservationGeolocation.md) |                                                                        | [optional] [default to undefined] |
| **author**         | **string**                                              | Optional author/creator identifier for the observation (e.g. username) | [optional] [default to undefined] |
| **device_id**      | **string**                                              | Optional client device identifier for the observation                  | [optional] [default to undefined] |
| **tags**           | **Array&lt;string&gt;**                                 | Optional list of string tags (labeling, extensions, data cleaning)     | [optional] [default to undefined] |

## Example

```typescript
import { Observation } from './api';

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
  author,
  device_id,
  tags,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
