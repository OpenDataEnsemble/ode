# ObservationTimeline


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**bucketUnit** | **string** | Bucket granularity (week when span of dated observations is &gt;&#x3D; 365 days) | [default to undefined]
**rangeStart** | **string** | First bucket start date (YYYY-MM-DD), empty when there are no observations | [default to undefined]
**rangeEnd** | **string** | Last bucket start date (YYYY-MM-DD), empty when there are no observations | [default to undefined]
**buckets** | [**Array&lt;ObservationTimelineBucket&gt;**](ObservationTimelineBucket.md) | Dense zero-filled buckets from rangeStart through rangeEnd | [default to undefined]

## Example

```typescript
import { ObservationTimeline } from './api';

const instance: ObservationTimeline = {
    bucketUnit,
    rangeStart,
    rangeEnd,
    buckets,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
