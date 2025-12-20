# HealthApi

All URIs are relative to _http://localhost_

| Method                      | HTTP request    | Description           |
| --------------------------- | --------------- | --------------------- |
| [**getHealth**](#gethealth) | **GET** /health | Health check endpoint |

# **getHealth**

> GetHealth200Response getHealth()

Returns the current health status of the service

### Example

```typescript
import {HealthApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const {status, data} = await apiInstance.getHealth();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**GetHealth200Response**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description          | Response headers |
| ----------- | -------------------- | ---------------- |
| **200**     | Service is healthy   | -                |
| **503**     | Service is unhealthy | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
