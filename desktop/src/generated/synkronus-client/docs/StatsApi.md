# StatsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getObservationStats**](StatsApi.md#getobservationstats) | **GET** /api/stats/observations | Observation aggregate stats for dashboard charts |



## getObservationStats

> ObservationStatsResponse getObservationStats(xOdeVersion)

Observation aggregate stats for dashboard charts

Returns non-deleted observation totals grouped by form type and a dense activity timeline bucketed by UTC calendar day (or week when the span is at least 365 days). Soft-deleted observations are excluded. Timeline dates use &#x60;created_at&#x60; interpreted in UTC. Intended for portal/desktop overview charts; not a general-purpose query API. 

### Example

```ts
import {
  Configuration,
  StatsApi,
} from '';
import type { GetObservationStatsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new StatsApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies GetObservationStatsRequest;

  try {
    const data = await api.getObservationStats(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **xOdeVersion** | `string` | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | [Defaults to `undefined`] |

### Return type

[**ObservationStatsResponse**](ObservationStatsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Observation aggregate stats |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

