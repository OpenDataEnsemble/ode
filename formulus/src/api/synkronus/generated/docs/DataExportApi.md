# DataExportApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getParquetExport**](#getparquetexport) | **GET** /dataexport/parquet | Download full Parquet export of all observations|

# **getParquetExport**
> File getParquetExport()

Returns a Parquet file containing all observations flattened and ready for analysis. Supports downloading the entire dataset as a single file. 

### Example

```typescript
import {
    DataExportApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DataExportApi(configuration);

const { status, data } = await apiInstance.getParquetExport();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**File**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/octet-stream


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Parquet file stream |  -  |
|**401** |  |  -  |
|**403** |  |  -  |
|**500** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

