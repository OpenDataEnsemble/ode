# AttachmentsApi

All URIs are relative to _http://localhost_

| Method                                                  | HTTP request                        | Description                                |
| ------------------------------------------------------- | ----------------------------------- | ------------------------------------------ |
| [**getAttachmentsExportZip**](#getattachmentsexportzip) | **GET** /api/attachments/export-zip | Download all attachments as a streamed ZIP |

# **getAttachmentsExportZip**

> File getAttachmentsExportZip()

Returns a ZIP containing every attachment whose latest manifest operation is create or update. Entry paths correspond to attachment IDs. Large exports stream without buffering the full archive in memory.

### Example

```typescript
import { AttachmentsApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new AttachmentsApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)

const { status, data } = await apiInstance.getAttachmentsExportZip(xOdeVersion);
```

### Parameters

| Name            | Type         | Description                                                                                                                                                          | Notes                 |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**File**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/zip, application/json

### HTTP response details

| Status code | Description                         | Response headers |
| ----------- | ----------------------------------- | ---------------- |
| **200**     | ZIP archive stream                  | -                |
| **401**     | Unauthorized                        | -                |
| **403**     | Forbidden                           | -                |
| **500**     | Internal server error               | -                |
| **503**     | Attachment storage is not available | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
