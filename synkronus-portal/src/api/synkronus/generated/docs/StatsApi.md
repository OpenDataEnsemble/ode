# StatsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getObservationStats**](#getobservationstats) | **GET** /api/stats/observations | Observation aggregate stats for dashboard charts|

# **getObservationStats**
> ObservationStatsResponse getObservationStats()

Returns non-deleted observation totals grouped by form type and a dense activity timeline bucketed by UTC calendar day (or week when the span is at least 365 days). Soft-deleted observations are excluded. Timeline dates use `created_at` interpreted in UTC. Intended for portal/desktop overview charts; not a general-purpose query API. 

### Example

```typescript
import {
    StatsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new StatsApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)

const { status, data } = await apiInstance.getObservationStats(
    xOdeVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined|


### Return type

**ObservationStatsResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Observation aggregate stats |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

