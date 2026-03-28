# DataExportApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getParquetExportZip**](#getparquetexportzip) | **GET** /api/dataexport/parquet | Download a ZIP archive of Parquet exports|
|[**getRawJsonExportZip**](#getrawjsonexportzip) | **GET** /api/dataexport/raw-json | Download a ZIP archive of per-observation JSON files|

# **getParquetExportZip**
> File getParquetExportZip()

Returns a ZIP file containing multiple Parquet files, each representing a flattened export of observations per form type. Supports downloading the entire dataset as separate Parquet files bundled together. 

### Example

```typescript
import {
    DataExportApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DataExportApi(configuration);

const { status, data } = await apiInstance.getParquetExportZip();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**File**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/zip, application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | ZIP archive stream containing Parquet files |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getRawJsonExportZip**
> File getRawJsonExportZip()

Returns a ZIP archive where each non-deleted observation is one JSON file, grouped by form type folder. Each file contains metadata fields and a nested `data` object with the form payload. 

### Example

```typescript
import {
    DataExportApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DataExportApi(configuration);

const { status, data } = await apiInstance.getRawJsonExportZip();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**File**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/zip, application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | ZIP archive stream containing JSON files |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

