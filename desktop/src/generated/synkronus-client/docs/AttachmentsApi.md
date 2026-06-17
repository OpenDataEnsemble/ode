# AttachmentsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getAttachmentsExportZip**](AttachmentsApi.md#getattachmentsexportzip) | **GET** /api/attachments/export-zip | Download all attachments as a streamed ZIP |



## getAttachmentsExportZip

> Blob getAttachmentsExportZip(xOdeVersion)

Download all attachments as a streamed ZIP

Returns a ZIP containing every attachment whose latest manifest operation is create or update. Entry paths correspond to attachment IDs. Large exports stream without buffering the full archive in memory. 

### Example

```ts
import {
  Configuration,
  AttachmentsApi,
} from '';
import type { GetAttachmentsExportZipRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AttachmentsApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies GetAttachmentsExportZipRequest;

  try {
    const data = await api.getAttachmentsExportZip(body);
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
| **200** | ZIP archive stream |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden |  -  |
| **500** | Internal server error |  -  |
| **503** | Attachment storage is not available |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

