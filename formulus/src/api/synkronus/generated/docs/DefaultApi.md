# DefaultApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**appBundleChangesGet**](#appbundlechangesget) | **GET** /app-bundle/changes | Get changes between two app bundle versions|
|[**appBundleDownloadPathGet**](#appbundledownloadpathget) | **GET** /app-bundle/download/{path} | Download a specific file from the app bundle|
|[**appBundleManifestGet**](#appbundlemanifestget) | **GET** /app-bundle/manifest | Get the current custom app bundle manifest|
|[**appBundlePushPost**](#appbundlepushpost) | **POST** /app-bundle/push | Upload a new app bundle (admin only)|
|[**appBundleSwitchVersionPost**](#appbundleswitchversionpost) | **POST** /app-bundle/switch/{version} | Switch to a specific app bundle version (admin only)|
|[**appBundleVersionsGet**](#appbundleversionsget) | **GET** /app-bundle/versions | Get a list of available app bundle versions|
|[**attachmentsAttachmentIdGet**](#attachmentsattachmentidget) | **GET** /attachments/{attachment_id} | Download an attachment by ID|
|[**attachmentsAttachmentIdHead**](#attachmentsattachmentidhead) | **HEAD** /attachments/{attachment_id} | Check if an attachment exists|
|[**attachmentsAttachmentIdPut**](#attachmentsattachmentidput) | **PUT** /attachments/{attachment_id} | Upload a new attachment with specified ID|
|[**attachmentsManifestPost**](#attachmentsmanifestpost) | **POST** /attachments/manifest | Get attachment manifest for incremental sync|
|[**authLoginPost**](#authloginpost) | **POST** /auth/login | Authenticate with the API|
|[**authRefreshPost**](#authrefreshpost) | **POST** /auth/refresh | Refresh authentication token|
|[**syncPullPost**](#syncpullpost) | **POST** /sync/pull | Pull updated records since last sync|
|[**syncPushPost**](#syncpushpost) | **POST** /sync/push | Push new or updated records to the server|
|[**usersChangePasswordPost**](#userschangepasswordpost) | **POST** /users/change-password | Change current user\&#39;s password|
|[**usersCreatePost**](#userscreatepost) | **POST** /users/create | Create a new user (admin only)|
|[**usersGet**](#usersget) | **GET** /users | List all users (admin only)|
|[**usersResetPasswordPost**](#usersresetpasswordpost) | **POST** /users/reset-password | Reset a user\&#39;s password (admin only)|
|[**usersUsernameDelete**](#usersusernamedelete) | **DELETE** /users/{username} | Delete a user (admin only)|
|[**versionGet**](#versionget) | **GET** /version | Get server version and system information|

# **appBundleChangesGet**
> ChangeLog appBundleChangesGet()

Compares two versions of the app bundle and returns detailed changes

### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let current: string; //The current version (defaults to latest) (optional) (default to undefined)
let target: string; //The target version to compare against (defaults to previous version) (optional) (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.appBundleChangesGet(
    current,
    target,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **current** | [**string**] | The current version (defaults to latest) | (optional) defaults to undefined|
| **target** | [**string**] | The target version to compare against (defaults to previous version) | (optional) defaults to undefined|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**ChangeLog**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successfully retrieved changes between versions |  -  |
|**400** | Invalid version format or parameters |  -  |
|**404** | One or both versions not found |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **appBundleDownloadPathGet**
> File appBundleDownloadPathGet()


### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let path: string; // (default to undefined)
let preview: boolean; //If true, returns the file from the latest version including unreleased changes (optional) (default to false)
let ifNoneMatch: string; // (optional) (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.appBundleDownloadPathGet(
    path,
    preview,
    ifNoneMatch,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **path** | [**string**] |  | defaults to undefined|
| **preview** | [**boolean**] | If true, returns the file from the latest version including unreleased changes | (optional) defaults to false|
| **ifNoneMatch** | [**string**] |  | (optional) defaults to undefined|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


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
|**200** | File content |  * etag -  <br>  |
|**304** | Not Modified |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **appBundleManifestGet**
> AppBundleManifest appBundleManifestGet()


### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.appBundleManifestGet(
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**AppBundleManifest**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Bundle file list |  * etag -  <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **appBundlePushPost**
> AppBundlePushResponse appBundlePushPost()


### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)
let bundle: File; //ZIP file containing the new app bundle (optional) (default to undefined)

const { status, data } = await apiInstance.appBundlePushPost(
    xApiVersion,
    bundle
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|
| **bundle** | [**File**] | ZIP file containing the new app bundle | (optional) defaults to undefined|


### Return type

**AppBundlePushResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | App bundle successfully uploaded |  -  |
|**400** | Bad request |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden - Admin role required |  -  |
|**413** | File too large |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **appBundleSwitchVersionPost**
> AppBundleSwitchVersionPost200Response appBundleSwitchVersionPost()


### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let version: string; //Version identifier to switch to (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.appBundleSwitchVersionPost(
    version,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **version** | [**string**] | Version identifier to switch to | defaults to undefined|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**AppBundleSwitchVersionPost200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successfully switched to the specified version |  -  |
|**400** | Bad request |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden - Admin role required |  -  |
|**404** | Version not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **appBundleVersionsGet**
> AppBundleVersions appBundleVersionsGet()


### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.appBundleVersionsGet(
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**AppBundleVersions**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | List of available app bundle versions |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **attachmentsAttachmentIdGet**
> File attachmentsAttachmentIdGet()


### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)

const { status, data } = await apiInstance.attachmentsAttachmentIdGet(
    attachmentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **attachmentId** | [**string**] |  | defaults to undefined|


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
|**200** | The binary attachment content |  -  |
|**401** | Unauthorized |  -  |
|**404** | Attachment not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **attachmentsAttachmentIdHead**
> attachmentsAttachmentIdHead()


### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)

const { status, data } = await apiInstance.attachmentsAttachmentIdHead(
    attachmentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **attachmentId** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Attachment exists |  -  |
|**401** | Unauthorized |  -  |
|**404** | Attachment not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **attachmentsAttachmentIdPut**
> AttachmentsAttachmentIdPut200Response attachmentsAttachmentIdPut()


### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)
let file: File; //The binary file to upload (default to undefined)

const { status, data } = await apiInstance.attachmentsAttachmentIdPut(
    attachmentId,
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **attachmentId** | [**string**] |  | defaults to undefined|
| **file** | [**File**] | The binary file to upload | defaults to undefined|


### Return type

**AttachmentsAttachmentIdPut200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful upload |  -  |
|**400** | Bad request (missing or invalid file) |  -  |
|**401** | Unauthorized |  -  |
|**409** | Conflict (attachment already exists and cannot be overwritten) |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **attachmentsManifestPost**
> AttachmentManifestResponse attachmentsManifestPost(attachmentManifestRequest)

Returns a manifest of attachment changes (new, updated, deleted) since a specified data version

### Example

```typescript
import {
    DefaultApi,
    Configuration,
    AttachmentManifestRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentManifestRequest: AttachmentManifestRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.attachmentsManifestPost(
    attachmentManifestRequest,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **attachmentManifestRequest** | **AttachmentManifestRequest**|  | |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**AttachmentManifestResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Attachment manifest with changes since specified version |  -  |
|**400** | Invalid request parameters |  -  |
|**401** | Unauthorized |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authLoginPost**
> AuthResponse authLoginPost(authLoginPostRequest)

Obtain a JWT token by providing username and password

### Example

```typescript
import {
    DefaultApi,
    Configuration,
    AuthLoginPostRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let authLoginPostRequest: AuthLoginPostRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.authLoginPost(
    authLoginPostRequest,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **authLoginPostRequest** | **AuthLoginPostRequest**|  | |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**AuthResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Authentication successful |  -  |
|**400** | Bad request |  -  |
|**401** | Authentication failed |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authRefreshPost**
> AuthResponse authRefreshPost(authRefreshPostRequest)

Obtain a new JWT token using a refresh token

### Example

```typescript
import {
    DefaultApi,
    Configuration,
    AuthRefreshPostRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let authRefreshPostRequest: AuthRefreshPostRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.authRefreshPost(
    authRefreshPostRequest,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **authRefreshPostRequest** | **AuthRefreshPostRequest**|  | |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**AuthResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Token refresh successful |  -  |
|**400** | Bad request |  -  |
|**401** | Invalid or expired refresh token |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **syncPullPost**
> SyncPullResponse syncPullPost(syncPullRequest)


### Example

```typescript
import {
    DefaultApi,
    Configuration,
    SyncPullRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let syncPullRequest: SyncPullRequest; //
let schemaType: string; //Filter by schemaType (optional) (default to undefined)
let limit: number; //Maximum number of records to return (optional) (default to 50)
let pageToken: string; //Pagination token from previous response (optional) (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.syncPullPost(
    syncPullRequest,
    schemaType,
    limit,
    pageToken,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **syncPullRequest** | **SyncPullRequest**|  | |
| **schemaType** | [**string**] | Filter by schemaType | (optional) defaults to undefined|
| **limit** | [**number**] | Maximum number of records to return | (optional) defaults to 50|
| **pageToken** | [**string**] | Pagination token from previous response | (optional) defaults to undefined|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**SyncPullResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Sync data |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **syncPushPost**
> SyncPushResponse syncPushPost(syncPushRequest)


### Example

```typescript
import {
    DefaultApi,
    Configuration,
    SyncPushRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let syncPushRequest: SyncPushRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.syncPushPost(
    syncPushRequest,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **syncPushRequest** | **SyncPushRequest**|  | |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**SyncPushResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Sync result |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **usersChangePasswordPost**
> UsersChangePasswordPost200Response usersChangePasswordPost(usersChangePasswordPostRequest)

Change password for the currently authenticated user

### Example

```typescript
import {
    DefaultApi,
    Configuration,
    UsersChangePasswordPostRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let usersChangePasswordPostRequest: UsersChangePasswordPostRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.usersChangePasswordPost(
    usersChangePasswordPostRequest,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **usersChangePasswordPostRequest** | **UsersChangePasswordPostRequest**|  | |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**UsersChangePasswordPost200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Password changed successfully |  -  |
|**400** | Bad request |  -  |
|**401** | Unauthorized or incorrect current password |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **usersCreatePost**
> UserResponse usersCreatePost(usersCreatePostRequest)

Create a new user with specified username, password, and role

### Example

```typescript
import {
    DefaultApi,
    Configuration,
    UsersCreatePostRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let usersCreatePostRequest: UsersCreatePostRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.usersCreatePost(
    usersCreatePostRequest,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **usersCreatePostRequest** | **UsersCreatePostRequest**|  | |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**UserResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | User created successfully |  -  |
|**400** | Bad request |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden - Admin role required |  -  |
|**409** | Conflict - Username already exists |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **usersGet**
> Array<UserResponse> usersGet()

Retrieve a list of all users in the system. Admin access required.

### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.usersGet(
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**Array<UserResponse>**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | List of all users |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden - Admin role required |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **usersResetPasswordPost**
> UsersResetPasswordPost200Response usersResetPasswordPost(usersResetPasswordPostRequest)

Reset password for a specified user

### Example

```typescript
import {
    DefaultApi,
    Configuration,
    UsersResetPasswordPostRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let usersResetPasswordPostRequest: UsersResetPasswordPostRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.usersResetPasswordPost(
    usersResetPasswordPostRequest,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **usersResetPasswordPostRequest** | **UsersResetPasswordPostRequest**|  | |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**UsersResetPasswordPost200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Password reset successfully |  -  |
|**400** | Bad request |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden - Admin role required |  -  |
|**404** | User not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **usersUsernameDelete**
> UsersUsernameDelete200Response usersUsernameDelete()

Delete a user by username

### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let username: string; //Username of the user to delete (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const { status, data } = await apiInstance.usersUsernameDelete(
    username,
    xApiVersion
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **username** | [**string**] | Username of the user to delete | defaults to undefined|
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined|


### Return type

**UsersUsernameDelete200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json, application/problem+json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | User deleted successfully |  -  |
|**400** | Bad request |  -  |
|**401** | Unauthorized |  -  |
|**403** | Forbidden - Admin role required |  -  |
|**404** | User not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **versionGet**
> SystemVersionInfo versionGet()

Returns detailed version information about the server, including build information and system details

### Example

```typescript
import {
    DefaultApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

const { status, data } = await apiInstance.versionGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**SystemVersionInfo**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful response with version information |  -  |
|**500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

