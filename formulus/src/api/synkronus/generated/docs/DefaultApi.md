# DefaultApi

All URIs are relative to _http://localhost_

| Method                                                | HTTP request                              | Description                                                                |
| ----------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| [**adminRepositoryReset**](#adminrepositoryreset)     | **POST** /api/admin/repository/reset      | Irreversibly wipe server observation and attachment sync data (admin only) |
| [**changePassword**](#changepassword)                 | **POST** /api/users/change-password       | Change user password (authenticated user)\&#39;s password                  |
| [**checkAttachmentExists**](#checkattachmentexists)   | **HEAD** /api/attachments/{attachment_id} | Check if an attachment exists                                              |
| [**createUser**](#createuser)                         | **POST** /api/users/create                | Create a new user (admin only)                                             |
| [**deleteUser**](#deleteuser)                         | **DELETE** /api/users/{username}          | Delete a user (admin only)                                                 |
| [**downloadAppBundleFile**](#downloadappbundlefile)   | **GET** /api/app-bundle/download/{path}   | Download a specific file from the app bundle                               |
| [**downloadAppBundleZip**](#downloadappbundlezip)     | **GET** /api/app-bundle/download-zip      | Download the active app bundle as a single ZIP                             |
| [**downloadAttachment**](#downloadattachment)         | **GET** /api/attachments/{attachment_id}  | Download an attachment by ID                                               |
| [**getAPIVersions**](#getapiversions)                 | **GET** /api/versions                     | List supported API contract versions                                       |
| [**getAppBundleChanges**](#getappbundlechanges)       | **GET** /api/app-bundle/changes           | Get changes between two app bundle versions                                |
| [**getAppBundleManifest**](#getappbundlemanifest)     | **GET** /api/app-bundle/manifest          | Get the current custom app bundle manifest                                 |
| [**getAppBundleVersions**](#getappbundleversions)     | **GET** /api/app-bundle/versions          | Get a list of available app bundle versions                                |
| [**getAttachmentManifest**](#getattachmentmanifest)   | **POST** /api/attachments/manifest        | Get attachment manifest for incremental sync                               |
| [**getVersion**](#getversion)                         | **GET** /api/version                      | Get server version and system information                                  |
| [**listUsers**](#listusers)                           | **GET** /api/users                        | List all users (admin only)                                                |
| [**login**](#login)                                   | **POST** /api/auth/login                  | Authenticate user and return JWT tokens                                    |
| [**pushAppBundle**](#pushappbundle)                   | **POST** /api/app-bundle/push             | Upload a new app bundle (admin only)                                       |
| [**refreshToken**](#refreshtoken)                     | **POST** /api/auth/refresh                | Refresh JWT token                                                          |
| [**resetUserPassword**](#resetuserpassword)           | **POST** /api/users/reset-password        | Reset user password (admin only)                                           |
| [**switchAppBundleVersion**](#switchappbundleversion) | **POST** /api/app-bundle/switch/{version} | Switch to a specific app bundle version (admin only)                       |
| [**syncPull**](#syncpull)                             | **POST** /api/sync/pull                   | Pull updated records since last sync                                       |
| [**syncPush**](#syncpush)                             | **POST** /api/sync/push                   | Push new or updated records to the server                                  |
| [**uploadAttachment**](#uploadattachment)             | **PUT** /api/attachments/{attachment_id}  | Upload a new attachment with specified ID                                  |

# **adminRepositoryReset**

> RepositoryResetResponse adminRepositoryReset(repositoryResetRequest)

Destructive operation: deletes all observations and attachment manifest rows, resets the observation stream cursor, increments repository_generation, and clears attachment files on disk. App bundles are not removed. Requires body `{ \"confirm\": \"RESET_REPOSITORY\" }`.

### Example

```typescript
import { DefaultApi, Configuration, RepositoryResetRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let repositoryResetRequest: RepositoryResetRequest; //

const { status, data } = await apiInstance.adminRepositoryReset(
  xOdeVersion,
  repositoryResetRequest,
);
```

### Parameters

| Name                       | Type                       | Description                                                                                                                                                          | Notes                 |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **repositoryResetRequest** | **RepositoryResetRequest** |                                                                                                                                                                      |                       |
| **xOdeVersion**            | [**string**]               | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**RepositoryResetResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description               | Response headers                  |
| ----------- | ------------------------- | --------------------------------- |
| **200**     | Reset completed           | \* x-repository-generation - <br> |
| **400**     | Invalid confirmation body | -                                 |
| **401**     | Unauthorized              | -                                 |
| **403**     | Forbidden (non-admin)     | -                                 |
| **500**     | Internal server error     | -                                 |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **changePassword**

> ChangePassword200Response changePassword(changePasswordRequest)

Change password for the currently authenticated user

### Example

```typescript
import { DefaultApi, Configuration, ChangePasswordRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let changePasswordRequest: ChangePasswordRequest; //

const { status, data } = await apiInstance.changePassword(
  xOdeVersion,
  changePasswordRequest,
);
```

### Parameters

| Name                      | Type                      | Description                                                                                                                                                          | Notes                 |
| ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **changePasswordRequest** | **ChangePasswordRequest** |                                                                                                                                                                      |                       |
| **xOdeVersion**           | [**string**]              | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**ChangePassword200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description                                | Response headers |
| ----------- | ------------------------------------------ | ---------------- |
| **200**     | Password changed successfully              | -                |
| **400**     | Bad request                                | -                |
| **401**     | Unauthorized or incorrect current password | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **checkAttachmentExists**

> checkAttachmentExists()

Checks whether the attachment is available for download. If `original=true` (or `1` / `yes`), existence is checked against the original file first, with fallback to the processed file.

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)
let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let original: string; //Prefer the original (uncompressed) attachment when available. Truthy values: `true`, `1`, `yes` (case-insensitive). Falls back to processed file when no original exists.  (optional) (default to undefined)

const { status, data } = await apiInstance.checkAttachmentExists(
  attachmentId,
  xOdeVersion,
  original,
);
```

### Parameters

| Name             | Type         | Description                                                                                                                                                                                             | Notes                            |
| ---------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **attachmentId** | [**string**] |                                                                                                                                                                                                         | defaults to undefined            |
| **xOdeVersion**  | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).                                    | defaults to undefined            |
| **original**     | [**string**] | Prefer the original (uncompressed) attachment when available. Truthy values: &#x60;true&#x60;, &#x60;1&#x60;, &#x60;yes&#x60; (case-insensitive). Falls back to processed file when no original exists. | (optional) defaults to undefined |

### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description          | Response headers |
| ----------- | -------------------- | ---------------- |
| **200**     | Attachment exists    | -                |
| **401**     | Unauthorized         | -                |
| **404**     | Attachment not found | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createUser**

> UserResponse createUser(createUserRequest)

Create a new user with specified username, password, and role

### Example

```typescript
import { DefaultApi, Configuration, CreateUserRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let createUserRequest: CreateUserRequest; //

const { status, data } = await apiInstance.createUser(
  xOdeVersion,
  createUserRequest,
);
```

### Parameters

| Name                  | Type                  | Description                                                                                                                                                          | Notes                 |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **createUserRequest** | **CreateUserRequest** |                                                                                                                                                                      |                       |
| **xOdeVersion**       | [**string**]          | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**UserResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description                        | Response headers |
| ----------- | ---------------------------------- | ---------------- |
| **201**     | User created successfully          | -                |
| **400**     | Bad request                        | -                |
| **401**     | Unauthorized                       | -                |
| **403**     | Forbidden - Admin role required    | -                |
| **409**     | Conflict - Username already exists | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteUser**

> DeleteUser200Response deleteUser()

Delete a user by username

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let username: string; //Username of the user to delete (default to undefined)
let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)

const { status, data } = await apiInstance.deleteUser(username, xOdeVersion);
```

### Parameters

| Name            | Type         | Description                                                                                                                                                          | Notes                 |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **username**    | [**string**] | Username of the user to delete                                                                                                                                       | defaults to undefined |
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**DeleteUser200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description                     | Response headers |
| ----------- | ------------------------------- | ---------------- |
| **200**     | User deleted successfully       | -                |
| **400**     | Bad request                     | -                |
| **401**     | Unauthorized                    | -                |
| **403**     | Forbidden - Admin role required | -                |
| **404**     | User not found                  | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **downloadAppBundleFile**

> File downloadAppBundleFile()

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let path: string; // (default to undefined)
let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let preview: boolean; //If true, returns the file from the latest version including unreleased changes (optional) (default to false)
let ifNoneMatch: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.downloadAppBundleFile(
  path,
  xOdeVersion,
  preview,
  ifNoneMatch,
);
```

### Parameters

| Name            | Type          | Description                                                                                                                                                          | Notes                            |
| --------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **path**        | [**string**]  |                                                                                                                                                                      | defaults to undefined            |
| **xOdeVersion** | [**string**]  | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined            |
| **preview**     | [**boolean**] | If true, returns the file from the latest version including unreleased changes                                                                                       | (optional) defaults to false     |
| **ifNoneMatch** | [**string**]  |                                                                                                                                                                      | (optional) defaults to undefined |

### Return type

**File**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/octet-stream

### HTTP response details

| Status code | Description  | Response headers |
| ----------- | ------------ | ---------------- |
| **200**     | File content | \* etag - <br>   |
| **304**     | Not Modified | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **downloadAppBundleZip**

> File downloadAppBundleZip()

Returns the full custom app bundle archive for the active version as `application/zip`.

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)

const { status, data } = await apiInstance.downloadAppBundleZip(xOdeVersion);
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

| Status code | Description                   | Response headers |
| ----------- | ----------------------------- | ---------------- |
| **200**     | ZIP archive of the app bundle | -                |
| **401**     | Unauthorized                  | -                |
| **404**     | Bundle zip not available      | -                |
| **500**     | Internal server error         | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **downloadAttachment**

> File downloadAttachment()

Downloads the processed attachment by default. If `original=true` (or `1` / `yes`) and an uncompressed sibling exists, the original file is returned. If no original exists, the endpoint falls back to the processed attachment.

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)
let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let original: string; //Prefer the original (uncompressed) attachment when available. Truthy values: `true`, `1`, `yes` (case-insensitive). Falls back to processed file when no original exists.  (optional) (default to undefined)

const { status, data } = await apiInstance.downloadAttachment(
  attachmentId,
  xOdeVersion,
  original,
);
```

### Parameters

| Name             | Type         | Description                                                                                                                                                                                             | Notes                            |
| ---------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **attachmentId** | [**string**] |                                                                                                                                                                                                         | defaults to undefined            |
| **xOdeVersion**  | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).                                    | defaults to undefined            |
| **original**     | [**string**] | Prefer the original (uncompressed) attachment when available. Truthy values: &#x60;true&#x60;, &#x60;1&#x60;, &#x60;yes&#x60; (case-insensitive). Falls back to processed file when no original exists. | (optional) defaults to undefined |

### Return type

**File**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/octet-stream

### HTTP response details

| Status code | Description                   | Response headers |
| ----------- | ----------------------------- | ---------------- |
| **200**     | The binary attachment content | -                |
| **401**     | Unauthorized                  | -                |
| **404**     | Attachment not found          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAPIVersions**

> APIVersionsResponse getAPIVersions()

Returns version metadata for the public HTTP API (compatibility hints for clients).

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)

const { status, data } = await apiInstance.getAPIVersions(xOdeVersion);
```

### Parameters

| Name            | Type         | Description                                                                                                                                                          | Notes                 |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**APIVersionsResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | API version list | -                |
| **401**     | Unauthorized     | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAppBundleChanges**

> ChangeLog getAppBundleChanges()

Compares two versions of the app bundle and returns detailed changes

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let current: string; //The current version (defaults to latest) (optional) (default to undefined)
let target: string; //The target version to compare against (defaults to previous version) (optional) (default to undefined)

const { status, data } = await apiInstance.getAppBundleChanges(
  xOdeVersion,
  current,
  target,
);
```

### Parameters

| Name            | Type         | Description                                                                                                                                                          | Notes                            |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined            |
| **current**     | [**string**] | The current version (defaults to latest)                                                                                                                             | (optional) defaults to undefined |
| **target**      | [**string**] | The target version to compare against (defaults to previous version)                                                                                                 | (optional) defaults to undefined |

### Return type

**ChangeLog**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                                     | Response headers |
| ----------- | ----------------------------------------------- | ---------------- |
| **200**     | Successfully retrieved changes between versions | -                |
| **400**     | Invalid version format or parameters            | -                |
| **404**     | One or both versions not found                  | -                |
| **500**     | Internal server error                           | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAppBundleManifest**

> AppBundleManifest getAppBundleManifest()

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let xOdeClientId: string; //Optional client instance id for correlating app bundle checks with presence. (optional) (default to undefined)

const { status, data } = await apiInstance.getAppBundleManifest(
  xOdeVersion,
  xOdeClientId,
);
```

### Parameters

| Name             | Type         | Description                                                                                                                                                          | Notes                            |
| ---------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **xOdeVersion**  | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined            |
| **xOdeClientId** | [**string**] | Optional client instance id for correlating app bundle checks with presence.                                                                                         | (optional) defaults to undefined |

### Return type

**AppBundleManifest**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Bundle file list | \* etag - <br>   |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAppBundleVersions**

> AppBundleVersions getAppBundleVersions()

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)

const { status, data } = await apiInstance.getAppBundleVersions(xOdeVersion);
```

### Parameters

| Name            | Type         | Description                                                                                                                                                          | Notes                 |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**AppBundleVersions**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                           | Response headers |
| ----------- | ------------------------------------- | ---------------- |
| **200**     | List of available app bundle versions | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAttachmentManifest**

> AttachmentManifestResponse getAttachmentManifest(attachmentManifestRequest)

Returns a manifest of attachment changes (new, updated, deleted) since a specified data version

### Example

```typescript
import { DefaultApi, Configuration, AttachmentManifestRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let attachmentManifestRequest: AttachmentManifestRequest; //
let xRepositoryGeneration: number; //Client repository epoch; must match the server. Omitted or invalid values are treated as 1. (optional) (default to undefined)

const { status, data } = await apiInstance.getAttachmentManifest(
  xOdeVersion,
  attachmentManifestRequest,
  xRepositoryGeneration,
);
```

### Parameters

| Name                          | Type                          | Description                                                                                                                                                          | Notes                            |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **attachmentManifestRequest** | **AttachmentManifestRequest** |                                                                                                                                                                      |                                  |
| **xOdeVersion**               | [**string**]                  | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined            |
| **xRepositoryGeneration**     | [**number**]                  | Client repository epoch; must match the server. Omitted or invalid values are treated as 1.                                                                          | (optional) defaults to undefined |

### Return type

**AttachmentManifestResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                                              | Response headers                  |
| ----------- | -------------------------------------------------------- | --------------------------------- |
| **200**     | Attachment manifest with changes since specified version | -                                 |
| **409**     | Repository epoch mismatch                                | \* x-repository-generation - <br> |
| **400**     | Invalid request parameters                               | -                                 |
| **401**     | Unauthorized                                             | -                                 |
| **500**     | Internal server error                                    | -                                 |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getVersion**

> SystemVersionInfo getVersion()

Returns detailed version information about the server, including build information and system details

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)

const { status, data } = await apiInstance.getVersion(xOdeVersion);
```

### Parameters

| Name            | Type         | Description                                                                                                                                                          | Notes                 |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**SystemVersionInfo**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                                  | Response headers |
| ----------- | -------------------------------------------- | ---------------- |
| **200**     | Successful response with version information | -                |
| **401**     | Unauthorized                                 | -                |
| **500**     | Internal server error                        | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listUsers**

> Array<UserListItem> listUsers()

Retrieve a list of all users in the system. Admin access required. Each item may include optional `presence` (last-seen per client, bundle/Ode hints) when the server has recorded activity.

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let xOdeClientId: string; //Optional client instance id (browser/CLI); used for presence when sent with authenticated requests. (optional) (default to undefined)

const { status, data } = await apiInstance.listUsers(xOdeVersion, xOdeClientId);
```

### Parameters

| Name             | Type         | Description                                                                                                                                                          | Notes                            |
| ---------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **xOdeVersion**  | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined            |
| **xOdeClientId** | [**string**] | Optional client instance id (browser/CLI); used for presence when sent with authenticated requests.                                                                  | (optional) defaults to undefined |

### Return type

**Array<UserListItem>**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description                     | Response headers |
| ----------- | ------------------------------- | ---------------- |
| **200**     | List of all users               | -                |
| **401**     | Unauthorized                    | -                |
| **403**     | Forbidden - Admin role required | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **login**

> AuthResponse login(loginRequest)

Obtain a JWT token by providing username and password

### Example

```typescript
import { DefaultApi, Configuration, LoginRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let loginRequest: LoginRequest; //

const { status, data } = await apiInstance.login(xOdeVersion, loginRequest);
```

### Parameters

| Name             | Type             | Description                                                                                                                                                          | Notes                 |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **loginRequest** | **LoginRequest** |                                                                                                                                                                      |                       |
| **xOdeVersion**  | [**string**]     | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**AuthResponse**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description               | Response headers |
| ----------- | ------------------------- | ---------------- |
| **200**     | Authentication successful | -                |
| **400**     | Bad request               | -                |
| **401**     | Authentication failed     | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **pushAppBundle**

> AppBundlePushResponse pushAppBundle()

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let bundle: File; //ZIP file containing the new app bundle (optional) (default to undefined)

const { status, data } = await apiInstance.pushAppBundle(xOdeVersion, bundle);
```

### Parameters

| Name            | Type         | Description                                                                                                                                                          | Notes                            |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined            |
| **bundle**      | [**File**]   | ZIP file containing the new app bundle                                                                                                                               | (optional) defaults to undefined |

### Return type

**AppBundlePushResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description                      | Response headers |
| ----------- | -------------------------------- | ---------------- |
| **200**     | App bundle successfully uploaded | -                |
| **400**     | Bad request                      | -                |
| **401**     | Unauthorized                     | -                |
| **403**     | Forbidden - Admin role required  | -                |
| **413**     | File too large                   | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **refreshToken**

> AuthResponse refreshToken(refreshTokenRequest)

Obtain a new JWT token using a refresh token

### Example

```typescript
import { DefaultApi, Configuration, RefreshTokenRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let refreshTokenRequest: RefreshTokenRequest; //

const { status, data } = await apiInstance.refreshToken(
  xOdeVersion,
  refreshTokenRequest,
);
```

### Parameters

| Name                    | Type                    | Description                                                                                                                                                          | Notes                 |
| ----------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **refreshTokenRequest** | **RefreshTokenRequest** |                                                                                                                                                                      |                       |
| **xOdeVersion**         | [**string**]            | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**AuthResponse**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description                      | Response headers |
| ----------- | -------------------------------- | ---------------- |
| **200**     | Token refresh successful         | -                |
| **400**     | Bad request                      | -                |
| **401**     | Invalid or expired refresh token | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **resetUserPassword**

> ResetUserPassword200Response resetUserPassword(resetUserPasswordRequest)

Reset password for a specified user

### Example

```typescript
import { DefaultApi, Configuration, ResetUserPasswordRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let resetUserPasswordRequest: ResetUserPasswordRequest; //

const { status, data } = await apiInstance.resetUserPassword(
  xOdeVersion,
  resetUserPasswordRequest,
);
```

### Parameters

| Name                         | Type                         | Description                                                                                                                                                          | Notes                 |
| ---------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **resetUserPasswordRequest** | **ResetUserPasswordRequest** |                                                                                                                                                                      |                       |
| **xOdeVersion**              | [**string**]                 | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**ResetUserPassword200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description                     | Response headers |
| ----------- | ------------------------------- | ---------------- |
| **200**     | Password reset successfully     | -                |
| **400**     | Bad request                     | -                |
| **401**     | Unauthorized                    | -                |
| **403**     | Forbidden - Admin role required | -                |
| **404**     | User not found                  | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **switchAppBundleVersion**

> SwitchAppBundleVersion200Response switchAppBundleVersion()

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let version: string; //Version identifier to switch to (default to undefined)
let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)

const { status, data } = await apiInstance.switchAppBundleVersion(
  version,
  xOdeVersion,
);
```

### Parameters

| Name            | Type         | Description                                                                                                                                                          | Notes                 |
| --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **version**     | [**string**] | Version identifier to switch to                                                                                                                                      | defaults to undefined |
| **xOdeVersion** | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined |

### Return type

**SwitchAppBundleVersion200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json, application/problem+json

### HTTP response details

| Status code | Description                                    | Response headers |
| ----------- | ---------------------------------------------- | ---------------- |
| **200**     | Successfully switched to the specified version | -                |
| **400**     | Bad request                                    | -                |
| **401**     | Unauthorized                                   | -                |
| **403**     | Forbidden - Admin role required                | -                |
| **404**     | Version not found                              | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **syncPull**

> SyncPullResponse syncPull(syncPullRequest)

Retrieves records that have changed since a specified version. **Pagination Pattern:** 1. Send initial request with `since.version` (or omit for all records) 2. Process returned records 3. If `has_more` is true, make next request using `change_cutoff` as the new `since.version` 4. Repeat until `has_more` is false Example pagination flow: - Request 1: `since: {version: 100}` → Response: `change_cutoff: 150, has_more: true` - Request 2: `since: {version: 150}` → Response: `change_cutoff: 200, has_more: false`

### Example

```typescript
import { DefaultApi, Configuration, SyncPullRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let syncPullRequest: SyncPullRequest; //
let schemaType: string; //Filter by schemaType (optional) (default to undefined)
let limit: number; //Maximum number of records to return (optional) (default to 50)
let xOdeClientId: string; //Optional client instance id; improves per-device presence when combined with sync body `client_id`. (optional) (default to undefined)
let xRepositoryGeneration: number; //Client repository epoch; must match the server. Omitted or invalid values are treated as 1. Successful responses include the current epoch in JSON and in this header. (optional) (default to undefined)

const { status, data } = await apiInstance.syncPull(
  xOdeVersion,
  syncPullRequest,
  schemaType,
  limit,
  xOdeClientId,
  xRepositoryGeneration,
);
```

### Parameters

| Name                      | Type                | Description                                                                                                                                                            | Notes                            |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **syncPullRequest**       | **SyncPullRequest** |                                                                                                                                                                        |                                  |
| **xOdeVersion**           | [**string**]        | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus).   | defaults to undefined            |
| **schemaType**            | [**string**]        | Filter by schemaType                                                                                                                                                   | (optional) defaults to undefined |
| **limit**                 | [**number**]        | Maximum number of records to return                                                                                                                                    | (optional) defaults to 50        |
| **xOdeClientId**          | [**string**]        | Optional client instance id; improves per-device presence when combined with sync body &#x60;client_id&#x60;.                                                          | (optional) defaults to undefined |
| **xRepositoryGeneration** | [**number**]        | Client repository epoch; must match the server. Omitted or invalid values are treated as 1. Successful responses include the current epoch in JSON and in this header. | (optional) defaults to undefined |

### Return type

**SyncPullResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                                                                                                      | Response headers                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **200**     | Sync data                                                                                                        | \* x-repository-generation - <br> |
| **409**     | Repository epoch mismatch (e.g. after admin hard reset). Client must align repository_generation before pulling. | \* x-repository-generation - <br> |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **syncPush**

> SyncPushResponse syncPush(syncPushRequest)

### Example

```typescript
import { DefaultApi, Configuration, SyncPushRequest } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let syncPushRequest: SyncPushRequest; //
let xOdeClientId: string; //Optional client instance id; improves per-device presence when combined with sync body `client_id`. (optional) (default to undefined)
let xRepositoryGeneration: number; //Client repository epoch; must match the server. Omitted or invalid values are treated as 1. (optional) (default to undefined)

const { status, data } = await apiInstance.syncPush(
  xOdeVersion,
  syncPushRequest,
  xOdeClientId,
  xRepositoryGeneration,
);
```

### Parameters

| Name                      | Type                | Description                                                                                                                                                          | Notes                            |
| ------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **syncPushRequest**       | **SyncPushRequest** |                                                                                                                                                                      |                                  |
| **xOdeVersion**           | [**string**]        | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined            |
| **xOdeClientId**          | [**string**]        | Optional client instance id; improves per-device presence when combined with sync body &#x60;client_id&#x60;.                                                        | (optional) defaults to undefined |
| **xRepositoryGeneration** | [**number**]        | Client repository epoch; must match the server. Omitted or invalid values are treated as 1.                                                                          | (optional) defaults to undefined |

### Return type

**SyncPushResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                                                                                                                             | Response headers                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **200**     | Sync result                                                                                                                             | \* x-repository-generation - <br> |
| **409**     | Repository epoch mismatch (e.g. after admin hard reset). Client must pull current state and align repository_generation before pushing. | \* x-repository-generation - <br> |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadAttachment**

> UploadAttachment200Response uploadAttachment()

### Example

```typescript
import { DefaultApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)
let xOdeVersion: string; //Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). (default to undefined)
let file: File; //The binary file to upload (default to undefined)
let xRepositoryGeneration: number; //Client repository epoch; must match the server. Omitted or invalid values are treated as 1. (optional) (default to undefined)

const { status, data } = await apiInstance.uploadAttachment(
  attachmentId,
  xOdeVersion,
  file,
  xRepositoryGeneration,
);
```

### Parameters

| Name                      | Type         | Description                                                                                                                                                          | Notes                            |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **attachmentId**          | [**string**] |                                                                                                                                                                      | defaults to undefined            |
| **xOdeVersion**           | [**string**] | Client semantic version; the major segment must match the server. Optional leading v/V and semver pre-release/build suffixes are accepted (same rules as Synkronus). | defaults to undefined            |
| **file**                  | [**File**]   | The binary file to upload                                                                                                                                            | defaults to undefined            |
| **xRepositoryGeneration** | [**number**] | Client repository epoch; must match the server. Omitted or invalid values are treated as 1.                                                                          | (optional) defaults to undefined |

### Return type

**UploadAttachment200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

### HTTP response details

| Status code | Description                                                                                          | Response headers |
| ----------- | ---------------------------------------------------------------------------------------------------- | ---------------- |
| **200**     | Successful upload                                                                                    | -                |
| **400**     | Bad request (missing or invalid file)                                                                | -                |
| **401**     | Unauthorized                                                                                         | -                |
| **409**     | Conflict — attachment already exists, or repository_generation mismatch (epoch; align before upload) | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
