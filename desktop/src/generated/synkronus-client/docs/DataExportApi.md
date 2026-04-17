# DataExportApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getParquetExportZip**](DataExportApi.md#getparquetexportzip) | **GET** /api/dataexport/parquet | Download a ZIP archive of Parquet exports |
| [**getRawJsonExportZip**](DataExportApi.md#getrawjsonexportzip) | **GET** /api/dataexport/raw-json | Download a ZIP archive of per-observation JSON files |



## getParquetExportZip

> Blob getParquetExportZip(xOdeVersion)

Download a ZIP archive of Parquet exports

Returns a ZIP file containing multiple Parquet files, each representing a flattened export of observations per form type. Supports downloading the entire dataset as separate Parquet files bundled together. 

### Example

```ts
import {
  Configuration,
  DataExportApi,
} from '';
import type { GetParquetExportZipRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DataExportApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies GetParquetExportZipRequest;

  try {
    const data = await api.getParquetExportZip(body);
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

**Blob**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/zip`, `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | ZIP archive stream containing Parquet files |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getRawJsonExportZip

> Blob getRawJsonExportZip(xOdeVersion)

Download a ZIP archive of per-observation JSON files

Returns a ZIP archive where each non-deleted observation is one JSON file, grouped by form type folder. Each file contains metadata fields and a nested &#x60;data&#x60; object with the form payload. 

### Example

```ts
import {
  Configuration,
  DataExportApi,
} from '';
import type { GetRawJsonExportZipRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DataExportApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies GetRawJsonExportZipRequest;

  try {
    const data = await api.getRawJsonExportZip(body);
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

**Blob**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/zip`, `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | ZIP archive stream containing JSON files |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

