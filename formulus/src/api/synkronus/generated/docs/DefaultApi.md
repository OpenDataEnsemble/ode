# DefaultApi

All URIs are relative to _http://localhost_

| Method                                                | HTTP request                          | Description                                               |
| ----------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| [**changePassword**](#changepassword)                 | **POST** /users/change-password       | Change user password (authenticated user)\&#39;s password |
| [**checkAttachmentExists**](#checkattachmentexists)   | **HEAD** /attachments/{attachment_id} | Check if an attachment exists                             |
| [**createUser**](#createuser)                         | **POST** /users/create                | Create a new user (admin only)                            |
| [**deleteUser**](#deleteuser)                         | **DELETE** /users/{username}          | Delete a user (admin only)                                |
| [**downloadAppBundleFile**](#downloadappbundlefile)   | **GET** /app-bundle/download/{path}   | Download a specific file from the app bundle              |
| [**downloadAttachment**](#downloadattachment)         | **GET** /attachments/{attachment_id}  | Download an attachment by ID                              |
| [**getAppBundleChanges**](#getappbundlechanges)       | **GET** /app-bundle/changes           | Get changes between two app bundle versions               |
| [**getAppBundleManifest**](#getappbundlemanifest)     | **GET** /app-bundle/manifest          | Get the current custom app bundle manifest                |
| [**getAppBundleVersions**](#getappbundleversions)     | **GET** /app-bundle/versions          | Get a list of available app bundle versions               |
| [**getAttachmentManifest**](#getattachmentmanifest)   | **POST** /attachments/manifest        | Get attachment manifest for incremental sync              |
| [**getVersion**](#getversion)                         | **GET** /version                      | Get server version and system information                 |
| [**listUsers**](#listusers)                           | **GET** /users                        | List all users (admin only)                               |
| [**login**](#login)                                   | **POST** /auth/login                  | Authenticate user and return JWT tokens                   |
| [**pushAppBundle**](#pushappbundle)                   | **POST** /app-bundle/push             | Upload a new app bundle (admin only)                      |
| [**refreshToken**](#refreshtoken)                     | **POST** /auth/refresh                | Refresh JWT token                                         |
| [**resetUserPassword**](#resetuserpassword)           | **POST** /users/reset-password        | Reset user password (admin only)                          |
| [**switchAppBundleVersion**](#switchappbundleversion) | **POST** /app-bundle/switch/{version} | Switch to a specific app bundle version (admin only)      |
| [**syncPull**](#syncpull)                             | **POST** /sync/pull                   | Pull updated records since last sync                      |
| [**syncPush**](#syncpush)                             | **POST** /sync/push                   | Push new or updated records to the server                 |
| [**uploadAttachment**](#uploadattachment)             | **PUT** /attachments/{attachment_id}  | Upload a new attachment with specified ID                 |

# **changePassword**

> ChangePassword200Response changePassword(changePasswordRequest)

Change password for the currently authenticated user

### Example

```typescript
import {DefaultApi, Configuration, ChangePasswordRequest} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let changePasswordRequest: ChangePasswordRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.changePassword(
  changePasswordRequest,
  xApiVersion,
);
```

### Parameters

| Name                      | Type                      | Description                                                               | Notes                            |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **changePasswordRequest** | **ChangePasswordRequest** |                                                                           |                                  |
| **xApiVersion**           | [**string**]              | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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

### Example

```typescript
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)

const {status, data} = await apiInstance.checkAttachmentExists(attachmentId);
```

### Parameters

| Name             | Type         | Description | Notes                 |
| ---------------- | ------------ | ----------- | --------------------- |
| **attachmentId** | [**string**] |             | defaults to undefined |

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
import {DefaultApi, Configuration, CreateUserRequest} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let createUserRequest: CreateUserRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.createUser(
  createUserRequest,
  xApiVersion,
);
```

### Parameters

| Name                  | Type                  | Description                                                               | Notes                            |
| --------------------- | --------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **createUserRequest** | **CreateUserRequest** |                                                                           |                                  |
| **xApiVersion**       | [**string**]          | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let username: string; //Username of the user to delete (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.deleteUser(username, xApiVersion);
```

### Parameters

| Name            | Type         | Description                                                               | Notes                            |
| --------------- | ------------ | ------------------------------------------------------------------------- | -------------------------------- |
| **username**    | [**string**] | Username of the user to delete                                            | defaults to undefined            |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let path: string; // (default to undefined)
let preview: boolean; //If true, returns the file from the latest version including unreleased changes (optional) (default to false)
let ifNoneMatch: string; // (optional) (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.downloadAppBundleFile(
  path,
  preview,
  ifNoneMatch,
  xApiVersion,
);
```

### Parameters

| Name            | Type          | Description                                                                    | Notes                            |
| --------------- | ------------- | ------------------------------------------------------------------------------ | -------------------------------- |
| **path**        | [**string**]  |                                                                                | defaults to undefined            |
| **preview**     | [**boolean**] | If true, returns the file from the latest version including unreleased changes | (optional) defaults to false     |
| **ifNoneMatch** | [**string**]  |                                                                                | (optional) defaults to undefined |
| **xApiVersion** | [**string**]  | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH)      | (optional) defaults to undefined |

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

# **downloadAttachment**

> File downloadAttachment()

### Example

```typescript
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)

const {status, data} = await apiInstance.downloadAttachment(attachmentId);
```

### Parameters

| Name             | Type         | Description | Notes                 |
| ---------------- | ------------ | ----------- | --------------------- |
| **attachmentId** | [**string**] |             | defaults to undefined |

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

# **getAppBundleChanges**

> ChangeLog getAppBundleChanges()

Compares two versions of the app bundle and returns detailed changes

### Example

```typescript
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let current: string; //The current version (defaults to latest) (optional) (default to undefined)
let target: string; //The target version to compare against (defaults to previous version) (optional) (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.getAppBundleChanges(
  current,
  target,
  xApiVersion,
);
```

### Parameters

| Name            | Type         | Description                                                               | Notes                            |
| --------------- | ------------ | ------------------------------------------------------------------------- | -------------------------------- |
| **current**     | [**string**] | The current version (defaults to latest)                                  | (optional) defaults to undefined |
| **target**      | [**string**] | The target version to compare against (defaults to previous version)      | (optional) defaults to undefined |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.getAppBundleManifest(xApiVersion);
```

### Parameters

| Name            | Type         | Description                                                               | Notes                            |
| --------------- | ------------ | ------------------------------------------------------------------------- | -------------------------------- |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.getAppBundleVersions(xApiVersion);
```

### Parameters

| Name            | Type         | Description                                                               | Notes                            |
| --------------- | ------------ | ------------------------------------------------------------------------- | -------------------------------- |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration, AttachmentManifestRequest} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentManifestRequest: AttachmentManifestRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.getAttachmentManifest(
  attachmentManifestRequest,
  xApiVersion,
);
```

### Parameters

| Name                          | Type                          | Description                                                               | Notes                            |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **attachmentManifestRequest** | **AttachmentManifestRequest** |                                                                           |                                  |
| **xApiVersion**               | [**string**]                  | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

### Return type

**AttachmentManifestResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                                              | Response headers |
| ----------- | -------------------------------------------------------- | ---------------- |
| **200**     | Attachment manifest with changes since specified version | -                |
| **400**     | Invalid request parameters                               | -                |
| **401**     | Unauthorized                                             | -                |
| **500**     | Internal server error                                    | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getVersion**

> SystemVersionInfo getVersion()

Returns detailed version information about the server, including build information and system details

### Example

```typescript
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

const {status, data} = await apiInstance.getVersion();
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

| Status code | Description                                  | Response headers |
| ----------- | -------------------------------------------- | ---------------- |
| **200**     | Successful response with version information | -                |
| **500**     | Internal server error                        | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listUsers**

> Array<UserResponse> listUsers()

Retrieve a list of all users in the system. Admin access required.

### Example

```typescript
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.listUsers(xApiVersion);
```

### Parameters

| Name            | Type         | Description                                                               | Notes                            |
| --------------- | ------------ | ------------------------------------------------------------------------- | -------------------------------- |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

### Return type

**Array<UserResponse>**

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
import {DefaultApi, Configuration, LoginRequest} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let loginRequest: LoginRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.login(loginRequest, xApiVersion);
```

### Parameters

| Name             | Type             | Description                                                               | Notes                            |
| ---------------- | ---------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **loginRequest** | **LoginRequest** |                                                                           |                                  |
| **xApiVersion**  | [**string**]     | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)
let bundle: File; //ZIP file containing the new app bundle (optional) (default to undefined)

const {status, data} = await apiInstance.pushAppBundle(xApiVersion, bundle);
```

### Parameters

| Name            | Type         | Description                                                               | Notes                            |
| --------------- | ------------ | ------------------------------------------------------------------------- | -------------------------------- |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |
| **bundle**      | [**File**]   | ZIP file containing the new app bundle                                    | (optional) defaults to undefined |

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
import {DefaultApi, Configuration, RefreshTokenRequest} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let refreshTokenRequest: RefreshTokenRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.refreshToken(
  refreshTokenRequest,
  xApiVersion,
);
```

### Parameters

| Name                    | Type                    | Description                                                               | Notes                            |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **refreshTokenRequest** | **RefreshTokenRequest** |                                                                           |                                  |
| **xApiVersion**         | [**string**]            | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration, ResetUserPasswordRequest} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let resetUserPasswordRequest: ResetUserPasswordRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.resetUserPassword(
  resetUserPasswordRequest,
  xApiVersion,
);
```

### Parameters

| Name                         | Type                         | Description                                                               | Notes                            |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **resetUserPasswordRequest** | **ResetUserPasswordRequest** |                                                                           |                                  |
| **xApiVersion**              | [**string**]                 | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let version: string; //Version identifier to switch to (default to undefined)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.switchAppBundleVersion(
  version,
  xApiVersion,
);
```

### Parameters

| Name            | Type         | Description                                                               | Notes                            |
| --------------- | ------------ | ------------------------------------------------------------------------- | -------------------------------- |
| **version**     | [**string**] | Version identifier to switch to                                           | defaults to undefined            |
| **xApiVersion** | [**string**] | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

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
import {DefaultApi, Configuration, SyncPullRequest} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let syncPullRequest: SyncPullRequest; //
let schemaType: string; //Filter by schemaType (optional) (default to undefined)
let limit: number; //Maximum number of records to return (optional) (default to 50)
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.syncPull(
  syncPullRequest,
  schemaType,
  limit,
  xApiVersion,
);
```

### Parameters

| Name                | Type                | Description                                                               | Notes                            |
| ------------------- | ------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **syncPullRequest** | **SyncPullRequest** |                                                                           |                                  |
| **schemaType**      | [**string**]        | Filter by schemaType                                                      | (optional) defaults to undefined |
| **limit**           | [**number**]        | Maximum number of records to return                                       | (optional) defaults to 50        |
| **xApiVersion**     | [**string**]        | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

### Return type

**SyncPullResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | Sync data   | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **syncPush**

> SyncPushResponse syncPush(syncPushRequest)

### Example

```typescript
import {DefaultApi, Configuration, SyncPushRequest} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let syncPushRequest: SyncPushRequest; //
let xApiVersion: string; //Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) (optional) (default to undefined)

const {status, data} = await apiInstance.syncPush(syncPushRequest, xApiVersion);
```

### Parameters

| Name                | Type                | Description                                                               | Notes                            |
| ------------------- | ------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **syncPushRequest** | **SyncPushRequest** |                                                                           |                                  |
| **xApiVersion**     | [**string**]        | Optional API version header using semantic versioning (MAJOR.MINOR.PATCH) | (optional) defaults to undefined |

### Return type

**SyncPushResponse**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | Sync result | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **uploadAttachment**

> UploadAttachment200Response uploadAttachment()

### Example

```typescript
import {DefaultApi, Configuration} from './api';

const configuration = new Configuration();
const apiInstance = new DefaultApi(configuration);

let attachmentId: string; // (default to undefined)
let file: File; //The binary file to upload (default to undefined)

const {status, data} = await apiInstance.uploadAttachment(attachmentId, file);
```

### Parameters

| Name             | Type         | Description               | Notes                 |
| ---------------- | ------------ | ------------------------- | --------------------- |
| **attachmentId** | [**string**] |                           | defaults to undefined |
| **file**         | [**File**]   | The binary file to upload | defaults to undefined |

### Return type

**UploadAttachment200Response**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: application/json

### HTTP response details

| Status code | Description                                                    | Response headers |
| ----------- | -------------------------------------------------------------- | ---------------- |
| **200**     | Successful upload                                              | -                |
| **400**     | Bad request (missing or invalid file)                          | -                |
| **401**     | Unauthorized                                                   | -                |
| **409**     | Conflict (attachment already exists and cannot be overwritten) | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
