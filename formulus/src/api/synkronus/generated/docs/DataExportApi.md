# DataExportApi

All URIs are relative to _http://localhost_

| Method                                          | HTTP request                | Description                               |
| ----------------------------------------------- | --------------------------- | ----------------------------------------- |
| [**getParquetExportZip**](#getparquetexportzip) | **GET** /dataexport/parquet | Download a ZIP archive of Parquet exports |

# **getParquetExportZip**

> File getParquetExportZip()

Returns a ZIP file containing multiple Parquet files, each representing a flattened export of observations per form type. Supports downloading the entire dataset as separate Parquet files bundled together.

### Example

```typescript
import {DataExportApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DataExportApi(configuration);

const {status, data} = await apiInstance.getParquetExportZip();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**File**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/zip

### HTTP response details

| Status code | Description                                 | Response headers |
| ----------- | ------------------------------------------- | ---------------- |
| **200**     | ZIP archive stream containing Parquet files | -                |
| **401**     |                                             | -                |
| **403**     |                                             | -                |
| **500**     |                                             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
