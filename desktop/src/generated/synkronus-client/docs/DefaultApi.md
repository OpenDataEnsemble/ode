# DefaultApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adminRepositoryReset**](DefaultApi.md#adminrepositoryreset) | **POST** /api/admin/repository/reset | Irreversibly wipe server observation and attachment sync data (admin only) |
| [**changePassword**](DefaultApi.md#changepasswordoperation) | **POST** /api/users/change-password | Change user password (authenticated user)\&#39;s password |
| [**checkAttachmentExists**](DefaultApi.md#checkattachmentexists) | **HEAD** /api/attachments/{attachment_id} | Check if an attachment exists |
| [**createUser**](DefaultApi.md#createuseroperation) | **POST** /api/users/create | Create a new user (admin only) |
| [**deleteUser**](DefaultApi.md#deleteuser) | **DELETE** /api/users/{username} | Delete a user (admin only) |
| [**downloadAppBundleFile**](DefaultApi.md#downloadappbundlefile) | **GET** /api/app-bundle/download/{path} | Download a specific file from the app bundle |
| [**downloadAppBundleZip**](DefaultApi.md#downloadappbundlezip) | **GET** /api/app-bundle/download-zip | Download the active app bundle as a single ZIP |
| [**downloadAttachment**](DefaultApi.md#downloadattachment) | **GET** /api/attachments/{attachment_id} | Download an attachment by ID |
| [**getAPIVersions**](DefaultApi.md#getapiversions) | **GET** /api/versions | List supported API contract versions |
| [**getAppBundleChanges**](DefaultApi.md#getappbundlechanges) | **GET** /api/app-bundle/changes | Get changes between two app bundle versions |
| [**getAppBundleManifest**](DefaultApi.md#getappbundlemanifest) | **GET** /api/app-bundle/manifest | Get the current custom app bundle manifest |
| [**getAppBundleVersions**](DefaultApi.md#getappbundleversions) | **GET** /api/app-bundle/versions | Get a list of available app bundle versions |
| [**getAttachmentManifest**](DefaultApi.md#getattachmentmanifest) | **POST** /api/attachments/manifest | Get attachment manifest for incremental sync |
| [**getVersion**](DefaultApi.md#getversion) | **GET** /api/version | Get server version and system information |
| [**listUsers**](DefaultApi.md#listusers) | **GET** /api/users | List all users (admin only) |
| [**login**](DefaultApi.md#loginoperation) | **POST** /api/auth/login | Authenticate user and return JWT tokens |
| [**pushAppBundle**](DefaultApi.md#pushappbundle) | **POST** /api/app-bundle/push | Upload a new app bundle (admin only) |
| [**refreshToken**](DefaultApi.md#refreshtokenoperation) | **POST** /api/auth/refresh | Refresh JWT token |
| [**resetUserPassword**](DefaultApi.md#resetuserpasswordoperation) | **POST** /api/users/reset-password | Reset user password (admin only) |
| [**switchAppBundleVersion**](DefaultApi.md#switchappbundleversion) | **POST** /api/app-bundle/switch/{version} | Switch to a specific app bundle version (admin only) |
| [**syncPull**](DefaultApi.md#syncpulloperation) | **POST** /api/sync/pull | Pull updated records since last sync |
| [**syncPush**](DefaultApi.md#syncpushoperation) | **POST** /api/sync/push | Push new or updated records to the server |
| [**uploadAttachment**](DefaultApi.md#uploadattachment) | **PUT** /api/attachments/{attachment_id} | Upload a new attachment with specified ID |



## adminRepositoryReset

> RepositoryResetResponse adminRepositoryReset(xOdeVersion, repositoryResetRequest)

Irreversibly wipe server observation and attachment sync data (admin only)

Destructive operation: deletes all observations and attachment manifest rows, resets the observation stream cursor, increments repository_generation, and clears attachment files on disk. App bundles are not removed. Requires body &#x60;{ \&quot;confirm\&quot;: \&quot;RESET_REPOSITORY\&quot; }&#x60;. 

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { AdminRepositoryResetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // RepositoryResetRequest
    repositoryResetRequest: ...,
  } satisfies AdminRepositoryResetRequest;

  try {
    const data = await api.adminRepositoryReset(body);
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
| **repositoryResetRequest** | [RepositoryResetRequest](RepositoryResetRequest.md) |  | |

### Return type

[**RepositoryResetResponse**](RepositoryResetResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Reset completed |  * x-repository-generation - New repository epoch after reset (same as response body &#x60;repository_generation&#x60;). <br>  |
| **400** | Invalid confirmation body |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden (non-admin) |  -  |
| **500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## changePassword

> ChangePassword200Response changePassword(xOdeVersion, changePasswordRequest)

Change user password (authenticated user)\&#39;s password

Change password for the currently authenticated user

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ChangePasswordOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // ChangePasswordRequest
    changePasswordRequest: ...,
  } satisfies ChangePasswordOperationRequest;

  try {
    const data = await api.changePassword(body);
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
| **changePasswordRequest** | [ChangePasswordRequest](ChangePasswordRequest.md) |  | |

### Return type

[**ChangePassword200Response**](ChangePassword200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Password changed successfully |  -  |
| **400** | Bad request |  -  |
| **401** | Unauthorized or incorrect current password |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## checkAttachmentExists

> checkAttachmentExists(attachmentId, xOdeVersion, original)

Check if an attachment exists

Checks whether the attachment is available for download. If &#x60;original&#x3D;true&#x60; (or &#x60;1&#x60; / &#x60;yes&#x60;), existence is checked against the original file first, with fallback to the processed file. 

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CheckAttachmentExistsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    attachmentId: abc123.jpg,
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // string | Prefer the original (uncompressed) attachment when available. Truthy values: `true`, `1`, `yes` (case-insensitive). Falls back to processed file when no original exists.  (optional)
    original: true,
  } satisfies CheckAttachmentExistsRequest;

  try {
    const data = await api.checkAttachmentExists(body);
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
| **attachmentId** | `string` |  | [Defaults to `undefined`] |
| **xOdeVersion** | `string` | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | [Defaults to `undefined`] |
| **original** | `string` | Prefer the original (uncompressed) attachment when available. Truthy values: &#x60;true&#x60;, &#x60;1&#x60;, &#x60;yes&#x60; (case-insensitive). Falls back to processed file when no original exists.  | [Optional] [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Attachment exists |  -  |
| **401** | Unauthorized |  -  |
| **404** | Attachment not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createUser

> UserResponse createUser(xOdeVersion, createUserRequest)

Create a new user (admin only)

Create a new user with specified username, password, and role

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CreateUserOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // CreateUserRequest
    createUserRequest: ...,
  } satisfies CreateUserOperationRequest;

  try {
    const data = await api.createUser(body);
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
| **createUserRequest** | [CreateUserRequest](CreateUserRequest.md) |  | |

### Return type

[**UserResponse**](UserResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | User created successfully |  -  |
| **400** | Bad request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden - Admin role required |  -  |
| **409** | Conflict - Username already exists |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteUser

> DeleteUser200Response deleteUser(username, xOdeVersion)

Delete a user (admin only)

Delete a user by username

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DeleteUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Username of the user to delete
    username: username_example,
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies DeleteUserRequest;

  try {
    const data = await api.deleteUser(body);
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
| **username** | `string` | Username of the user to delete | [Defaults to `undefined`] |
| **xOdeVersion** | `string` | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | [Defaults to `undefined`] |

### Return type

[**DeleteUser200Response**](DeleteUser200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | User deleted successfully |  -  |
| **400** | Bad request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden - Admin role required |  -  |
| **404** | User not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## downloadAppBundleFile

> Blob downloadAppBundleFile(path, xOdeVersion, preview, ifNoneMatch)

Download a specific file from the app bundle

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DownloadAppBundleFileRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    path: path_example,
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // boolean | If true, returns the file from the latest version including unreleased changes (optional)
    preview: true,
    // string (optional)
    ifNoneMatch: ifNoneMatch_example,
  } satisfies DownloadAppBundleFileRequest;

  try {
    const data = await api.downloadAppBundleFile(body);
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
| **path** | `string` |  | [Defaults to `undefined`] |
| **xOdeVersion** | `string` | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | [Defaults to `undefined`] |
| **preview** | `boolean` | If true, returns the file from the latest version including unreleased changes | [Optional] [Defaults to `false`] |
| **ifNoneMatch** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**Blob**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/octet-stream`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | File content |  * etag -  <br>  |
| **304** | Not Modified |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## downloadAppBundleZip

> Blob downloadAppBundleZip(xOdeVersion)

Download the active app bundle as a single ZIP

Returns the full custom app bundle archive for the active version as &#x60;application/zip&#x60;.

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DownloadAppBundleZipRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies DownloadAppBundleZipRequest;

  try {
    const data = await api.downloadAppBundleZip(body);
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
| **200** | ZIP archive of the app bundle |  -  |
| **401** | Unauthorized |  -  |
| **404** | Bundle zip not available |  -  |
| **500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## downloadAttachment

> Blob downloadAttachment(attachmentId, xOdeVersion, original)

Download an attachment by ID

Downloads the processed attachment by default. If &#x60;original&#x3D;true&#x60; (or &#x60;1&#x60; / &#x60;yes&#x60;) and an uncompressed sibling exists, the original file is returned. If no original exists, the endpoint falls back to the processed attachment. 

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DownloadAttachmentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    attachmentId: abc123.jpg,
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // string | Prefer the original (uncompressed) attachment when available. Truthy values: `true`, `1`, `yes` (case-insensitive). Falls back to processed file when no original exists.  (optional)
    original: true,
  } satisfies DownloadAttachmentRequest;

  try {
    const data = await api.downloadAttachment(body);
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
| **attachmentId** | `string` |  | [Defaults to `undefined`] |
| **xOdeVersion** | `string` | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | [Defaults to `undefined`] |
| **original** | `string` | Prefer the original (uncompressed) attachment when available. Truthy values: &#x60;true&#x60;, &#x60;1&#x60;, &#x60;yes&#x60; (case-insensitive). Falls back to processed file when no original exists.  | [Optional] [Defaults to `undefined`] |

### Return type

**Blob**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/octet-stream`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The binary attachment content |  -  |
| **401** | Unauthorized |  -  |
| **404** | Attachment not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAPIVersions

> APIVersionsResponse getAPIVersions(xOdeVersion)

List supported API contract versions

Returns version metadata for the public HTTP API (compatibility hints for clients).

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetAPIVersionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies GetAPIVersionsRequest;

  try {
    const data = await api.getAPIVersions(body);
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

[**APIVersionsResponse**](APIVersionsResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | API version list |  -  |
| **401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAppBundleChanges

> ChangeLog getAppBundleChanges(xOdeVersion, current, target)

Get changes between two app bundle versions

Compares two versions of the app bundle and returns detailed changes

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetAppBundleChangesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // string | The current version (defaults to latest) (optional)
    current: current_example,
    // string | The target version to compare against (defaults to previous version) (optional)
    target: target_example,
  } satisfies GetAppBundleChangesRequest;

  try {
    const data = await api.getAppBundleChanges(body);
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
| **current** | `string` | The current version (defaults to latest) | [Optional] [Defaults to `undefined`] |
| **target** | `string` | The target version to compare against (defaults to previous version) | [Optional] [Defaults to `undefined`] |

### Return type

[**ChangeLog**](ChangeLog.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successfully retrieved changes between versions |  -  |
| **400** | Invalid version format or parameters |  -  |
| **404** | One or both versions not found |  -  |
| **500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAppBundleManifest

> AppBundleManifest getAppBundleManifest(xOdeVersion, xOdeClientId)

Get the current custom app bundle manifest

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetAppBundleManifestRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // string | Optional client instance id for correlating app bundle checks with presence. (optional)
    xOdeClientId: xOdeClientId_example,
  } satisfies GetAppBundleManifestRequest;

  try {
    const data = await api.getAppBundleManifest(body);
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
| **xOdeClientId** | `string` | Optional client instance id for correlating app bundle checks with presence. | [Optional] [Defaults to `undefined`] |

### Return type

[**AppBundleManifest**](AppBundleManifest.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Bundle file list |  * etag - Hash of the manifest for caching <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAppBundleVersions

> AppBundleVersions getAppBundleVersions(xOdeVersion)

Get a list of available app bundle versions

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetAppBundleVersionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies GetAppBundleVersionsRequest;

  try {
    const data = await api.getAppBundleVersions(body);
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

[**AppBundleVersions**](AppBundleVersions.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | List of available app bundle versions |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getAttachmentManifest

> AttachmentManifestResponse getAttachmentManifest(xOdeVersion, attachmentManifestRequest, xRepositoryGeneration)

Get attachment manifest for incremental sync

Returns a manifest of attachment changes (new, updated, deleted) since a specified data version

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetAttachmentManifestRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // AttachmentManifestRequest
    attachmentManifestRequest: ...,
    // number | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. (optional)
    xRepositoryGeneration: 789,
  } satisfies GetAttachmentManifestRequest;

  try {
    const data = await api.getAttachmentManifest(body);
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
| **attachmentManifestRequest** | [AttachmentManifestRequest](AttachmentManifestRequest.md) |  | |
| **xRepositoryGeneration** | `number` | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. | [Optional] [Defaults to `undefined`] |

### Return type

[**AttachmentManifestResponse**](AttachmentManifestResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Attachment manifest with changes since specified version |  -  |
| **409** | Repository epoch mismatch |  * x-repository-generation -  <br>  |
| **400** | Invalid request parameters |  -  |
| **401** | Unauthorized |  -  |
| **500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getVersion

> SystemVersionInfo getVersion(xOdeVersion)

Get server version and system information

Returns detailed version information about the server, including build information and system details

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetVersionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies GetVersionRequest;

  try {
    const data = await api.getVersion(body);
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

[**SystemVersionInfo**](SystemVersionInfo.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful response with version information |  -  |
| **401** | Unauthorized |  -  |
| **500** | Internal server error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listUsers

> Array&lt;UserListItem&gt; listUsers(xOdeVersion, xOdeClientId)

List all users (admin only)

Retrieve a list of all users in the system. Admin access required. Each item may include optional &#x60;presence&#x60; (last-seen per client, bundle/Ode hints) when the server has recorded activity. 

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ListUsersRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // string | Optional client instance id (browser/CLI); used for presence when sent with authenticated requests. (optional)
    xOdeClientId: xOdeClientId_example,
  } satisfies ListUsersRequest;

  try {
    const data = await api.listUsers(body);
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
| **xOdeClientId** | `string` | Optional client instance id (browser/CLI); used for presence when sent with authenticated requests. | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;UserListItem&gt;**](UserListItem.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | List of all users |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden - Admin role required |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## login

> AuthResponse login(xOdeVersion, loginRequest)

Authenticate user and return JWT tokens

Obtain a JWT token by providing username and password

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { LoginOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // LoginRequest
    loginRequest: ...,
  } satisfies LoginOperationRequest;

  try {
    const data = await api.login(body);
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
| **loginRequest** | [LoginRequest](LoginRequest.md) |  | |

### Return type

[**AuthResponse**](AuthResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Authentication successful |  -  |
| **400** | Bad request |  -  |
| **401** | Authentication failed |  -  |
| **413** | Authentication request exceeds the configured size limit |  -  |
| **429** | Too many authentication attempts |  * Retry-After - Seconds until the client should retry <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## pushAppBundle

> AppBundlePushResponse pushAppBundle(xOdeVersion, bundle)

Upload a new app bundle (admin only)

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { PushAppBundleRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // Blob | ZIP file containing the new app bundle (optional)
    bundle: BINARY_DATA_HERE,
  } satisfies PushAppBundleRequest;

  try {
    const data = await api.pushAppBundle(body);
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
| **bundle** | `Blob` | ZIP file containing the new app bundle | [Optional] [Defaults to `undefined`] |

### Return type

[**AppBundlePushResponse**](AppBundlePushResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | App bundle successfully uploaded |  -  |
| **400** | Bad request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden - Admin role required |  -  |
| **413** | File too large |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## refreshToken

> AuthResponse refreshToken(xOdeVersion, refreshTokenRequest)

Refresh JWT token

Obtain a new JWT token using a refresh token

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { RefreshTokenOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // RefreshTokenRequest
    refreshTokenRequest: ...,
  } satisfies RefreshTokenOperationRequest;

  try {
    const data = await api.refreshToken(body);
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
| **refreshTokenRequest** | [RefreshTokenRequest](RefreshTokenRequest.md) |  | |

### Return type

[**AuthResponse**](AuthResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Token refresh successful |  -  |
| **400** | Bad request |  -  |
| **401** | Invalid or expired refresh token |  -  |
| **413** | Authentication request exceeds the configured size limit |  -  |
| **429** | Too many authentication attempts |  * Retry-After - Seconds until the client should retry <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## resetUserPassword

> ResetUserPassword200Response resetUserPassword(xOdeVersion, resetUserPasswordRequest)

Reset user password (admin only)

Reset password for a specified user

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ResetUserPasswordOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // ResetUserPasswordRequest
    resetUserPasswordRequest: ...,
  } satisfies ResetUserPasswordOperationRequest;

  try {
    const data = await api.resetUserPassword(body);
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
| **resetUserPasswordRequest** | [ResetUserPasswordRequest](ResetUserPasswordRequest.md) |  | |

### Return type

[**ResetUserPassword200Response**](ResetUserPassword200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Password reset successfully |  -  |
| **400** | Bad request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden - Admin role required |  -  |
| **404** | User not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## switchAppBundleVersion

> SwitchAppBundleVersion200Response switchAppBundleVersion(version, xOdeVersion)

Switch to a specific app bundle version (admin only)

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { SwitchAppBundleVersionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Version identifier to switch to
    version: version_example,
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
  } satisfies SwitchAppBundleVersionRequest;

  try {
    const data = await api.switchAppBundleVersion(body);
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
| **version** | `string` | Version identifier to switch to | [Defaults to `undefined`] |
| **xOdeVersion** | `string` | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | [Defaults to `undefined`] |

### Return type

[**SwitchAppBundleVersion200Response**](SwitchAppBundleVersion200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successfully switched to the specified version |  -  |
| **400** | Bad request |  -  |
| **401** | Unauthorized |  -  |
| **403** | Forbidden - Admin role required |  -  |
| **404** | Version not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## syncPull

> SyncPullResponse syncPull(xOdeVersion, syncPullRequest, schemaType, limit, xOdeClientId, xRepositoryGeneration)

Pull updated records since last sync

Retrieves records that have changed since a specified version.  **Pagination Pattern:** 1. Send initial request with &#x60;since.version&#x60; (or omit for all records) 2. Process returned records 3. If &#x60;has_more&#x60; is true, make next request using &#x60;change_cutoff&#x60; as the new &#x60;since.version&#x60; 4. Repeat until &#x60;has_more&#x60; is false  Example pagination flow: - Request 1: &#x60;since: {version: 100}&#x60; → Response: &#x60;change_cutoff: 150, has_more: true&#x60; - Request 2: &#x60;since: {version: 150}&#x60; → Response: &#x60;change_cutoff: 200, has_more: false&#x60; 

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { SyncPullOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // SyncPullRequest
    syncPullRequest: ...,
    // string | Filter by schemaType (optional)
    schemaType: schemaType_example,
    // number | Maximum number of records to return (optional)
    limit: 56,
    // string | Optional client instance id; improves per-device presence when combined with sync body `client_id`. (optional)
    xOdeClientId: xOdeClientId_example,
    // number | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. Successful responses include the current epoch in JSON and in this header. (optional)
    xRepositoryGeneration: 789,
  } satisfies SyncPullOperationRequest;

  try {
    const data = await api.syncPull(body);
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
| **syncPullRequest** | [SyncPullRequest](SyncPullRequest.md) |  | |
| **schemaType** | `string` | Filter by schemaType | [Optional] [Defaults to `undefined`] |
| **limit** | `number` | Maximum number of records to return | [Optional] [Defaults to `50`] |
| **xOdeClientId** | `string` | Optional client instance id; improves per-device presence when combined with sync body &#x60;client_id&#x60;. | [Optional] [Defaults to `undefined`] |
| **xRepositoryGeneration** | `number` | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. Successful responses include the current epoch in JSON and in this header. | [Optional] [Defaults to `undefined`] |

### Return type

[**SyncPullResponse**](SyncPullResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Sync data |  * x-repository-generation - Current repository epoch (same as response body &#x60;repository_generation&#x60;). <br>  |
| **409** | Repository epoch mismatch (e.g. after admin hard reset). Client must align repository_generation before pulling. |  * x-repository-generation -  <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## syncPush

> SyncPushResponse syncPush(xOdeVersion, syncPushRequest, xOdeClientId, xRepositoryGeneration)

Push new or updated records to the server

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { SyncPushOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // SyncPushRequest
    syncPushRequest: ...,
    // string | Optional client instance id; improves per-device presence when combined with sync body `client_id`. (optional)
    xOdeClientId: xOdeClientId_example,
    // number | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. (optional)
    xRepositoryGeneration: 789,
  } satisfies SyncPushOperationRequest;

  try {
    const data = await api.syncPush(body);
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
| **syncPushRequest** | [SyncPushRequest](SyncPushRequest.md) |  | |
| **xOdeClientId** | `string` | Optional client instance id; improves per-device presence when combined with sync body &#x60;client_id&#x60;. | [Optional] [Defaults to `undefined`] |
| **xRepositoryGeneration** | `number` | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. | [Optional] [Defaults to `undefined`] |

### Return type

[**SyncPushResponse**](SyncPushResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Sync result |  * x-repository-generation - Current repository epoch (same as response body &#x60;repository_generation&#x60;). <br>  |
| **409** | Repository epoch mismatch (e.g. after admin hard reset). Client must pull current state and align repository_generation before pushing. |  * x-repository-generation -  <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadAttachment

> UploadAttachment200Response uploadAttachment(attachmentId, xOdeVersion, file, xRepositoryGeneration)

Upload a new attachment with specified ID

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { UploadAttachmentRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DefaultApi(config);

  const body = {
    // string
    attachmentId: abc123.jpg,
    // string | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).
    xOdeVersion: 1.0.0,
    // Blob | The binary file to upload
    file: BINARY_DATA_HERE,
    // number | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. (optional)
    xRepositoryGeneration: 789,
  } satisfies UploadAttachmentRequest;

  try {
    const data = await api.uploadAttachment(body);
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
| **attachmentId** | `string` |  | [Defaults to `undefined`] |
| **xOdeVersion** | `string` | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | [Defaults to `undefined`] |
| **file** | `Blob` | The binary file to upload | [Defaults to `undefined`] |
| **xRepositoryGeneration** | `number` | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. | [Optional] [Defaults to `undefined`] |

### Return type

[**UploadAttachment200Response**](UploadAttachment200Response.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful upload |  -  |
| **400** | Bad request (missing or invalid file) |  -  |
| **401** | Unauthorized |  -  |
| **403** | Authenticated account does not have write access |  -  |
| **413** | Attachment or multipart request exceeds the configured upload limit |  -  |
| **409** | Conflict — attachment already exists, or repository_generation mismatch (epoch; align before upload) |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

