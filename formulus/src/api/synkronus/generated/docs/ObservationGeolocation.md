# ObservationGeolocation

Optional geolocation data for the observation

## Properties

| Name                  | Type       | Description                         | Notes                             |
| --------------------- | ---------- | ----------------------------------- | --------------------------------- |
| **latitude**          | **number** | Latitude in decimal degrees         | [optional] [default to undefined] |
| **longitude**         | **number** | Longitude in decimal degrees        | [optional] [default to undefined] |
| **accuracy**          | **number** | Horizontal accuracy in meters       | [optional] [default to undefined] |
| **altitude**          | **number** | Elevation in meters above sea level | [optional] [default to undefined] |
| **altitude_accuracy** | **number** | Vertical accuracy in meters         | [optional] [default to undefined] |

## Example

```typescript
import {ObservationGeolocation} from './api';

const instance: ObservationGeolocation = {
  latitude,
  longitude,
  accuracy,
  altitude,
  altitude_accuracy,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
