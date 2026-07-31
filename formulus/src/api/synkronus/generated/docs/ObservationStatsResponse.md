# ObservationStatsResponse

## Properties

| Name           | Type                                                                     | Description                                    | Notes                  |
| -------------- | ------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------- |
| **totalCount** | **number**                                                               | Total non-deleted observations                 | [default to undefined] |
| **byFormType** | [**Array&lt;ObservationFormTypeCount&gt;**](ObservationFormTypeCount.md) |                                                | [default to undefined] |
| **timeline**   | [**ObservationTimeline**](ObservationTimeline.md)                        |                                                | [default to undefined] |
| **computedAt** | **string**                                                               | UTC timestamp when this aggregate was computed | [default to undefined] |

## Example

```typescript
import { ObservationStatsResponse } from './api';

const instance: ObservationStatsResponse = {
  totalCount,
  byFormType,
  timeline,
  computedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
