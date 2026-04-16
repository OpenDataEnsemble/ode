// @ts-nocheck
/* tslint:disable */
/* eslint-disable */
/**
 * 
 * @export
 * @interface APIVersionInfo
 */
export interface APIVersionInfo {
    /**
     * 
     * @type {string}
     * @memberof APIVersionInfo
     */
    version: string;
    /**
     * 
     * @type {Date}
     * @memberof APIVersionInfo
     */
    releaseDate: Date;
    /**
     * 
     * @type {boolean}
     * @memberof APIVersionInfo
     */
    deprecated: boolean;
}
/**
 * 
 * @export
 * @interface APIVersionsResponse
 */
export interface APIVersionsResponse {
    /**
     * 
     * @type {Array<APIVersionInfo>}
     * @memberof APIVersionsResponse
     */
    versions: Array<APIVersionInfo>;
    /**
     * Identifier of the current API contract version
     * @type {string}
     * @memberof APIVersionsResponse
     */
    current: string;
}
/**
 * 
 * @export
 * @interface AppBundleChangeLog
 */
export interface AppBundleChangeLog {
    /**
     * 
     * @type {string}
     * @memberof AppBundleChangeLog
     */
    compare_version_a: string;
    /**
     * 
     * @type {string}
     * @memberof AppBundleChangeLog
     */
    compare_version_b: string;
    /**
     * 
     * @type {boolean}
     * @memberof AppBundleChangeLog
     */
    form_changes: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof AppBundleChangeLog
     */
    ui_changes: boolean;
    /**
     * 
     * @type {Array<FormDiff>}
     * @memberof AppBundleChangeLog
     */
    new_forms?: Array<FormDiff>;
    /**
     * 
     * @type {Array<FormDiff>}
     * @memberof AppBundleChangeLog
     */
    removed_forms?: Array<FormDiff>;
    /**
     * 
     * @type {Array<FormModification>}
     * @memberof AppBundleChangeLog
     */
    modified_forms?: Array<FormModification>;
}
/**
 * 
 * @export
 * @interface AppBundleFile
 */
export interface AppBundleFile {
    /**
     * 
     * @type {string}
     * @memberof AppBundleFile
     */
    path: string;
    /**
     * 
     * @type {number}
     * @memberof AppBundleFile
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof AppBundleFile
     */
    hash: string;
    /**
     * 
     * @type {string}
     * @memberof AppBundleFile
     */
    mimeType: string;
    /**
     * 
     * @type {Date}
     * @memberof AppBundleFile
     */
    modTime: Date;
}
/**
 * 
 * @export
 * @interface AppBundleManifest
 */
export interface AppBundleManifest {
    /**
     * 
     * @type {Array<AppBundleFile>}
     * @memberof AppBundleManifest
     */
    files: Array<AppBundleFile>;
    /**
     * 
     * @type {string}
     * @memberof AppBundleManifest
     */
    version: string;
    /**
     * 
     * @type {Date}
     * @memberof AppBundleManifest
     */
    generatedAt: Date;
    /**
     * 
     * @type {string}
     * @memberof AppBundleManifest
     */
    hash: string;
}
/**
 * 
 * @export
 * @interface AppBundlePushResponse
 */
export interface AppBundlePushResponse {
    /**
     * 
     * @type {string}
     * @memberof AppBundlePushResponse
     */
    message: string;
    /**
     * 
     * @type {AppBundleManifest}
     * @memberof AppBundlePushResponse
     */
    manifest: AppBundleManifest;
}
/**
 * 
 * @export
 * @interface AppBundleVersions
 */
export interface AppBundleVersions {
    /**
     * 
     * @type {Array<string>}
     * @memberof AppBundleVersions
     */
    versions: Array<string>;
}
/**
 * 
 * @export
 * @interface AttachmentManifestRequest
 */
export interface AttachmentManifestRequest {
    /**
     * Unique identifier for the client requesting the manifest
     * @type {string}
     * @memberof AttachmentManifestRequest
     */
    client_id: string;
    /**
     * Data version number from which to get attachment changes (0 for all attachments)
     * @type {number}
     * @memberof AttachmentManifestRequest
     */
    since_version: number;
    /**
     * Optional body copy of epoch; header wins when both are sent.
     * @type {number}
     * @memberof AttachmentManifestRequest
     */
    repository_generation?: number;
}
/**
 * 
 * @export
 * @interface AttachmentManifestResponse
 */
export interface AttachmentManifestResponse {
    /**
     * Current database version number
     * @type {number}
     * @memberof AttachmentManifestResponse
     */
    current_version: number;
    /**
     * Monotonic repository epoch
     * @type {number}
     * @memberof AttachmentManifestResponse
     */
    repository_generation: number;
    /**
     * List of attachment operations to perform
     * @type {Array<AttachmentOperation>}
     * @memberof AttachmentManifestResponse
     */
    operations: Array<AttachmentOperation>;
    /**
     * Total size in bytes of all attachments to download
     * @type {number}
     * @memberof AttachmentManifestResponse
     */
    total_download_size?: number;
    /**
     * 
     * @type {AttachmentManifestResponseOperationCount}
     * @memberof AttachmentManifestResponse
     */
    operation_count?: AttachmentManifestResponseOperationCount;
}
/**
 * Count of operations by type
 * @export
 * @interface AttachmentManifestResponseOperationCount
 */
export interface AttachmentManifestResponseOperationCount {
    /**
     * 
     * @type {number}
     * @memberof AttachmentManifestResponseOperationCount
     */
    download?: number;
    /**
     * 
     * @type {number}
     * @memberof AttachmentManifestResponseOperationCount
     */
    _delete?: number;
}
/**
 * 
 * @export
 * @interface AttachmentOperation
 */
export interface AttachmentOperation {
    /**
     * Operation to perform on the attachment
     * @type {AttachmentOperationOperationEnum}
     * @memberof AttachmentOperation
     */
    operation: AttachmentOperationOperationEnum;
    /**
     * Unique identifier for the attachment
     * @type {string}
     * @memberof AttachmentOperation
     */
    attachment_id: string;
    /**
     * URL to download the attachment (only present for download operations)
     * @type {string}
     * @memberof AttachmentOperation
     */
    download_url?: string;
    /**
     * Size of the attachment in bytes (only present for download operations)
     * @type {number}
     * @memberof AttachmentOperation
     */
    size?: number;
    /**
     * MIME type of the attachment (only present for download operations)
     * @type {string}
     * @memberof AttachmentOperation
     */
    content_type?: string;
    /**
     * Version when this attachment was created/modified/deleted
     * @type {number}
     * @memberof AttachmentOperation
     */
    version?: number;
}


/**
 * @export
 */
export const AttachmentOperationOperationEnum = {
    Download: 'download',
    Delete: 'delete'
} as const;
export type AttachmentOperationOperationEnum = typeof AttachmentOperationOperationEnum[keyof typeof AttachmentOperationOperationEnum];

/**
 * 
 * @export
 * @interface AuthResponse
 */
export interface AuthResponse {
    /**
     * 
     * @type {string}
     * @memberof AuthResponse
     */
    token: string;
    /**
     * 
     * @type {string}
     * @memberof AuthResponse
     */
    refreshToken: string;
    /**
     * 
     * @type {number}
     * @memberof AuthResponse
     */
    expiresAt: number;
}
/**
 * 
 * @export
 * @interface BuildInfo
 */
export interface BuildInfo {
    /**
     * 
     * @type {string}
     * @memberof BuildInfo
     */
    commit?: string;
    /**
     * 
     * @type {string}
     * @memberof BuildInfo
     */
    build_time?: string;
    /**
     * 
     * @type {string}
     * @memberof BuildInfo
     */
    go_version?: string;
}
/**
 * 
 * @export
 * @interface ChangeLog
 */
export interface ChangeLog {
    /**
     * 
     * @type {string}
     * @memberof ChangeLog
     */
    compare_version_a?: string;
    /**
     * 
     * @type {string}
     * @memberof ChangeLog
     */
    compare_version_b?: string;
    /**
     * 
     * @type {boolean}
     * @memberof ChangeLog
     */
    form_changes?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof ChangeLog
     */
    ui_changes?: boolean;
    /**
     * 
     * @type {Array<FormDiff>}
     * @memberof ChangeLog
     */
    new_forms?: Array<FormDiff>;
    /**
     * 
     * @type {Array<FormDiff>}
     * @memberof ChangeLog
     */
    removed_forms?: Array<FormDiff>;
    /**
     * 
     * @type {Array<FormModification>}
     * @memberof ChangeLog
     */
    modified_forms?: Array<FormModification>;
}
/**
 * 
 * @export
 * @interface ChangePassword200Response
 */
export interface ChangePassword200Response {
    /**
     * 
     * @type {string}
     * @memberof ChangePassword200Response
     */
    message?: string;
}
/**
 * 
 * @export
 * @interface ChangePasswordRequest
 */
export interface ChangePasswordRequest {
    /**
     * Current password for verification
     * @type {string}
     * @memberof ChangePasswordRequest
     */
    currentPassword: string;
    /**
     * New password to set
     * @type {string}
     * @memberof ChangePasswordRequest
     */
    newPassword: string;
}
/**
 * 
 * @export
 * @interface CreateUserRequest
 */
export interface CreateUserRequest {
    /**
     * New user's username
     * @type {string}
     * @memberof CreateUserRequest
     */
    username: string;
    /**
     * New user's password
     * @type {string}
     * @memberof CreateUserRequest
     */
    password: string;
    /**
     * User's role
     * @type {CreateUserRequestRoleEnum}
     * @memberof CreateUserRequest
     */
    role: CreateUserRequestRoleEnum;
}


/**
 * @export
 */
export const CreateUserRequestRoleEnum = {
    ReadOnly: 'read-only',
    ReadWrite: 'read-write',
    Admin: 'admin'
} as const;
export type CreateUserRequestRoleEnum = typeof CreateUserRequestRoleEnum[keyof typeof CreateUserRequestRoleEnum];

/**
 * 
 * @export
 * @interface DatabaseInfo
 */
export interface DatabaseInfo {
    /**
     * 
     * @type {string}
     * @memberof DatabaseInfo
     */
    type?: string;
    /**
     * 
     * @type {string}
     * @memberof DatabaseInfo
     */
    version?: string;
    /**
     * 
     * @type {string}
     * @memberof DatabaseInfo
     */
    database_name?: string;
}
/**
 * 
 * @export
 * @interface DeleteUser200Response
 */
export interface DeleteUser200Response {
    /**
     * 
     * @type {string}
     * @memberof DeleteUser200Response
     */
    message?: string;
}
/**
 * 
 * @export
 * @interface ErrorResponse
 */
export interface ErrorResponse {
    /**
     * 
     * @type {string}
     * @memberof ErrorResponse
     */
    error?: string;
    /**
     * Optional human-readable detail
     * @type {string}
     * @memberof ErrorResponse
     */
    message?: string;
    /**
     * Stable machine-readable code (e.g. repository_reset_required)
     * @type {string}
     * @memberof ErrorResponse
     */
    code?: string;
}
/**
 * 
 * @export
 * @interface FieldChange
 */
export interface FieldChange {
    /**
     * 
     * @type {string}
     * @memberof FieldChange
     */
    field?: string;
    /**
     * 
     * @type {string}
     * @memberof FieldChange
     */
    type?: string;
}
/**
 * 
 * @export
 * @interface FormDiff
 */
export interface FormDiff {
    /**
     * 
     * @type {string}
     * @memberof FormDiff
     */
    form?: string;
}
/**
 * 
 * @export
 * @interface FormModification
 */
export interface FormModification {
    /**
     * 
     * @type {string}
     * @memberof FormModification
     */
    form?: string;
    /**
     * 
     * @type {boolean}
     * @memberof FormModification
     */
    schema_changed?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof FormModification
     */
    ui_changed?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof FormModification
     */
    core_changed?: boolean;
    /**
     * 
     * @type {Array<FieldChange>}
     * @memberof FormModification
     */
    added_fields?: Array<FieldChange>;
    /**
     * 
     * @type {Array<FieldChange>}
     * @memberof FormModification
     */
    removed_fields?: Array<FieldChange>;
}
/**
 * 
 * @export
 * @interface GetHealth200Response
 */
export interface GetHealth200Response {
    /**
     * 
     * @type {GetHealth200ResponseStatusEnum}
     * @memberof GetHealth200Response
     */
    status?: GetHealth200ResponseStatusEnum;
    /**
     * Current server time
     * @type {Date}
     * @memberof GetHealth200Response
     */
    timestamp?: Date;
    /**
     * Current API version
     * @type {string}
     * @memberof GetHealth200Response
     */
    version?: string;
}


/**
 * @export
 */
export const GetHealth200ResponseStatusEnum = {
    Ok: 'ok'
} as const;
export type GetHealth200ResponseStatusEnum = typeof GetHealth200ResponseStatusEnum[keyof typeof GetHealth200ResponseStatusEnum];

/**
 * 
 * @export
 * @interface GetHealth503Response
 */
export interface GetHealth503Response {
    /**
     * 
     * @type {GetHealth503ResponseStatusEnum}
     * @memberof GetHealth503Response
     */
    status?: GetHealth503ResponseStatusEnum;
    /**
     * Description of the error
     * @type {string}
     * @memberof GetHealth503Response
     */
    error?: string;
    /**
     * Current server time
     * @type {Date}
     * @memberof GetHealth503Response
     */
    timestamp?: Date;
}


/**
 * @export
 */
export const GetHealth503ResponseStatusEnum = {
    Error: 'error'
} as const;
export type GetHealth503ResponseStatusEnum = typeof GetHealth503ResponseStatusEnum[keyof typeof GetHealth503ResponseStatusEnum];

/**
 * 
 * @export
 * @interface LoginRequest
 */
export interface LoginRequest {
    /**
     * User's username
     * @type {string}
     * @memberof LoginRequest
     */
    username: string;
    /**
     * User's password
     * @type {string}
     * @memberof LoginRequest
     */
    password: string;
}
/**
 * 
 * @export
 * @interface Observation
 */
export interface Observation {
    /**
     * 
     * @type {string}
     * @memberof Observation
     */
    observation_id: string;
    /**
     * 
     * @type {string}
     * @memberof Observation
     */
    form_type: string;
    /**
     * 
     * @type {string}
     * @memberof Observation
     */
    form_version: string;
    /**
     * Arbitrary JSON object containing form data
     * @type {object}
     * @memberof Observation
     */
    data: object;
    /**
     * 
     * @type {Date}
     * @memberof Observation
     */
    created_at: Date;
    /**
     * 
     * @type {Date}
     * @memberof Observation
     */
    updated_at: Date;
    /**
     * 
     * @type {Date}
     * @memberof Observation
     */
    synced_at?: Date | null;
    /**
     * 
     * @type {boolean}
     * @memberof Observation
     */
    deleted: boolean;
    /**
     * 
     * @type {ObservationGeolocation}
     * @memberof Observation
     */
    geolocation?: ObservationGeolocation | null;
    /**
     * Optional author/creator identifier for the observation (e.g. username)
     * @type {string}
     * @memberof Observation
     */
    author?: string | null;
    /**
     * Optional client device identifier for the observation
     * @type {string}
     * @memberof Observation
     */
    device_id?: string | null;
    /**
     * Optional list of string tags (labeling, extensions, data cleaning)
     * @type {Array<string>}
     * @memberof Observation
     */
    tags?: Array<string> | null;
}
/**
 * Optional geolocation data for the observation
 * @export
 * @interface ObservationGeolocation
 */
export interface ObservationGeolocation {
    /**
     * Latitude in decimal degrees
     * @type {number}
     * @memberof ObservationGeolocation
     */
    latitude?: number;
    /**
     * Longitude in decimal degrees
     * @type {number}
     * @memberof ObservationGeolocation
     */
    longitude?: number;
    /**
     * Horizontal accuracy in meters
     * @type {number}
     * @memberof ObservationGeolocation
     */
    accuracy?: number;
    /**
     * Elevation in meters above sea level
     * @type {number}
     * @memberof ObservationGeolocation
     */
    altitude?: number | null;
    /**
     * Vertical accuracy in meters
     * @type {number}
     * @memberof ObservationGeolocation
     */
    altitude_accuracy?: number | null;
    /**
     * When the GPS fix was obtained (ISO 8601)
     * @type {Date}
     * @memberof ObservationGeolocation
     */
    timestamp?: Date;
}
/**
 * 
 * @export
 * @interface ProblemDetail
 */
export interface ProblemDetail {
    /**
     * 
     * @type {string}
     * @memberof ProblemDetail
     */
    type: string;
    /**
     * 
     * @type {string}
     * @memberof ProblemDetail
     */
    title: string;
    /**
     * 
     * @type {number}
     * @memberof ProblemDetail
     */
    status: number;
    /**
     * 
     * @type {string}
     * @memberof ProblemDetail
     */
    detail: string;
    /**
     * 
     * @type {string}
     * @memberof ProblemDetail
     */
    instance?: string;
    /**
     * 
     * @type {Array<ProblemDetailErrorsInner>}
     * @memberof ProblemDetail
     */
    errors?: Array<ProblemDetailErrorsInner>;
}
/**
 * 
 * @export
 * @interface ProblemDetailErrorsInner
 */
export interface ProblemDetailErrorsInner {
    /**
     * 
     * @type {string}
     * @memberof ProblemDetailErrorsInner
     */
    field?: string;
    /**
     * 
     * @type {string}
     * @memberof ProblemDetailErrorsInner
     */
    message?: string;
}
/**
 * 
 * @export
 * @interface RefreshTokenRequest
 */
export interface RefreshTokenRequest {
    /**
     * Refresh token obtained from login or previous refresh
     * @type {string}
     * @memberof RefreshTokenRequest
     */
    refreshToken: string;
}
/**
 * 
 * @export
 * @interface RepositoryResetRequest
 */
export interface RepositoryResetRequest {
    /**
     * Must be exactly RESET_REPOSITORY to authorize destructive reset
     * @type {RepositoryResetRequestConfirmEnum}
     * @memberof RepositoryResetRequest
     */
    confirm: RepositoryResetRequestConfirmEnum;
}


/**
 * @export
 */
export const RepositoryResetRequestConfirmEnum = {
    ResetRepository: 'RESET_REPOSITORY'
} as const;
export type RepositoryResetRequestConfirmEnum = typeof RepositoryResetRequestConfirmEnum[keyof typeof RepositoryResetRequestConfirmEnum];

/**
 * 
 * @export
 * @interface RepositoryResetResponse
 */
export interface RepositoryResetResponse {
    /**
     * New repository epoch after reset
     * @type {number}
     * @memberof RepositoryResetResponse
     */
    repository_generation: number;
    /**
     * 
     * @type {string}
     * @memberof RepositoryResetResponse
     */
    message: string;
}
/**
 * 
 * @export
 * @interface ResetUserPassword200Response
 */
export interface ResetUserPassword200Response {
    /**
     * 
     * @type {string}
     * @memberof ResetUserPassword200Response
     */
    message?: string;
}
/**
 * 
 * @export
 * @interface ResetUserPasswordRequest
 */
export interface ResetUserPasswordRequest {
    /**
     * Username of the user whose password is being reset
     * @type {string}
     * @memberof ResetUserPasswordRequest
     */
    username: string;
    /**
     * New password for the user
     * @type {string}
     * @memberof ResetUserPasswordRequest
     */
    newPassword: string;
}
/**
 * 
 * @export
 * @interface ServerInfo
 */
export interface ServerInfo {
    /**
     * 
     * @type {string}
     * @memberof ServerInfo
     */
    version?: string;
}
/**
 * 
 * @export
 * @interface SwitchAppBundleVersion200Response
 */
export interface SwitchAppBundleVersion200Response {
    /**
     * 
     * @type {string}
     * @memberof SwitchAppBundleVersion200Response
     */
    message?: string;
}
/**
 * 
 * @export
 * @interface SyncPullRequest
 */
export interface SyncPullRequest {
    /**
     * 
     * @type {string}
     * @memberof SyncPullRequest
     */
    client_id: string;
    /**
     * Optional body copy of epoch; header x-repository-generation wins when both are sent. Must match the server or the request returns 409.
     * @type {number}
     * @memberof SyncPullRequest
     */
    repository_generation?: number;
    /**
     * 
     * @type {SyncPullRequestSince}
     * @memberof SyncPullRequest
     */
    since?: SyncPullRequestSince;
    /**
     * 
     * @type {Array<string>}
     * @memberof SyncPullRequest
     */
    schema_types?: Array<string>;
}
/**
 * Optional pagination cursor indicating the last seen change
 * @export
 * @interface SyncPullRequestSince
 */
export interface SyncPullRequestSince {
    /**
     * 
     * @type {number}
     * @memberof SyncPullRequestSince
     */
    version?: number;
    /**
     * 
     * @type {string}
     * @memberof SyncPullRequestSince
     */
    id?: string;
}
/**
 * 
 * @export
 * @interface SyncPullResponse
 */
export interface SyncPullResponse {
    /**
     * Current database version number that increments with each update
     * @type {number}
     * @memberof SyncPullResponse
     */
    current_version: number;
    /**
     * Monotonic repository epoch (increments on admin hard reset only)
     * @type {number}
     * @memberof SyncPullResponse
     */
    repository_generation: number;
    /**
     * 
     * @type {Array<Observation>}
     * @memberof SyncPullResponse
     */
    records: Array<Observation>;
    /**
     * Version number of the last change included in this response. Use this as the next 'since.version' for pagination.
     * @type {number}
     * @memberof SyncPullResponse
     */
    change_cutoff: number;
    /**
     * Indicates if there are more records available beyond this response
     * @type {boolean}
     * @memberof SyncPullResponse
     */
    has_more?: boolean;
    /**
     * 
     * @type {string}
     * @memberof SyncPullResponse
     */
    sync_format_version?: string;
}
/**
 * 
 * @export
 * @interface SyncPushRequest
 */
export interface SyncPushRequest {
    /**
     * 
     * @type {string}
     * @memberof SyncPushRequest
     */
    transmission_id: string;
    /**
     * 
     * @type {string}
     * @memberof SyncPushRequest
     */
    client_id: string;
    /**
     * Optional body copy of epoch; header x-repository-generation wins when both are sent.
     * @type {number}
     * @memberof SyncPushRequest
     */
    repository_generation?: number;
    /**
     * 
     * @type {Array<Observation>}
     * @memberof SyncPushRequest
     */
    records: Array<Observation>;
}
/**
 * 
 * @export
 * @interface SyncPushResponse
 */
export interface SyncPushResponse {
    /**
     * Current database version number after processing the push
     * @type {number}
     * @memberof SyncPushResponse
     */
    current_version: number;
    /**
     * 
     * @type {number}
     * @memberof SyncPushResponse
     */
    repository_generation: number;
    /**
     * 
     * @type {number}
     * @memberof SyncPushResponse
     */
    success_count: number;
    /**
     * 
     * @type {Array<object>}
     * @memberof SyncPushResponse
     */
    failed_records?: Array<object>;
    /**
     * 
     * @type {Array<SyncPushResponseWarningsInner>}
     * @memberof SyncPushResponse
     */
    warnings?: Array<SyncPushResponseWarningsInner>;
}
/**
 * 
 * @export
 * @interface SyncPushResponseWarningsInner
 */
export interface SyncPushResponseWarningsInner {
    /**
     * 
     * @type {string}
     * @memberof SyncPushResponseWarningsInner
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SyncPushResponseWarningsInner
     */
    code: string;
    /**
     * 
     * @type {string}
     * @memberof SyncPushResponseWarningsInner
     */
    message: string;
}
/**
 * 
 * @export
 * @interface SystemInfo
 */
export interface SystemInfo {
    /**
     * 
     * @type {string}
     * @memberof SystemInfo
     */
    os?: string;
    /**
     * 
     * @type {string}
     * @memberof SystemInfo
     */
    architecture?: string;
    /**
     * 
     * @type {number}
     * @memberof SystemInfo
     */
    cpus?: number;
}
/**
 * 
 * @export
 * @interface SystemVersionInfo
 */
export interface SystemVersionInfo {
    /**
     * 
     * @type {ServerInfo}
     * @memberof SystemVersionInfo
     */
    server?: ServerInfo;
    /**
     * 
     * @type {DatabaseInfo}
     * @memberof SystemVersionInfo
     */
    database?: DatabaseInfo;
    /**
     * 
     * @type {SystemInfo}
     * @memberof SystemVersionInfo
     */
    system?: SystemInfo;
    /**
     * 
     * @type {BuildInfo}
     * @memberof SystemVersionInfo
     */
    build?: BuildInfo;
}
/**
 * 
 * @export
 * @interface UploadAttachment200Response
 */
export interface UploadAttachment200Response {
    /**
     * 
     * @type {string}
     * @memberof UploadAttachment200Response
     */
    status?: string;
}
/**
 * 
 * @export
 * @interface UserListItem
 */
export interface UserListItem {
    /**
     * 
     * @type {string}
     * @memberof UserListItem
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof UserListItem
     */
    username: string;
    /**
     * 
     * @type {UserListItemRoleEnum}
     * @memberof UserListItem
     */
    role: UserListItemRoleEnum;
    /**
     * 
     * @type {Date}
     * @memberof UserListItem
     */
    createdAt: Date;
    /**
     * 
     * @type {Date}
     * @memberof UserListItem
     */
    updatedAt: Date;
    /**
     * 
     * @type {UserPresenceSummary}
     * @memberof UserListItem
     */
    presence?: UserPresenceSummary;
}


/**
 * @export
 */
export const UserListItemRoleEnum = {
    ReadOnly: 'read-only',
    ReadWrite: 'read-write',
    Admin: 'admin'
} as const;
export type UserListItemRoleEnum = typeof UserListItemRoleEnum[keyof typeof UserListItemRoleEnum];

/**
 * 
 * @export
 * @interface UserPresenceClient
 */
export interface UserPresenceClient {
    /**
     * Client id from sync or empty string when unknown
     * @type {string}
     * @memberof UserPresenceClient
     */
    clientId: string;
    /**
     * 
     * @type {Date}
     * @memberof UserPresenceClient
     */
    lastSeenAt: Date;
    /**
     * Last known sync data version cursor hint for this client
     * @type {number}
     * @memberof UserPresenceClient
     */
    lastDataVersion?: number;
    /**
     * 
     * @type {string}
     * @memberof UserPresenceClient
     */
    appBundleVersion?: string;
    /**
     * ODE/Formulus client version header last seen for this row
     * @type {string}
     * @memberof UserPresenceClient
     */
    lastOdeVersion?: string;
}
/**
 * 
 * @export
 * @interface UserPresenceSummary
 */
export interface UserPresenceSummary {
    /**
     * Latest activity across all clients for this user
     * @type {Date}
     * @memberof UserPresenceSummary
     */
    lastSeenAt?: Date;
    /**
     * Number of distinct client ids seen
     * @type {number}
     * @memberof UserPresenceSummary
     */
    clientCount?: number;
    /**
     * 
     * @type {Array<UserPresenceClient>}
     * @memberof UserPresenceSummary
     */
    clients?: Array<UserPresenceClient>;
}
/**
 * 
 * @export
 * @interface UserResponse
 */
export interface UserResponse {
    /**
     * 
     * @type {string}
     * @memberof UserResponse
     */
    username: string;
    /**
     * 
     * @type {UserResponseRoleEnum}
     * @memberof UserResponse
     */
    role: UserResponseRoleEnum;
    /**
     * 
     * @type {Date}
     * @memberof UserResponse
     */
    createdAt: Date;
}


/**
 * @export
 */
export const UserResponseRoleEnum = {
    ReadOnly: 'read-only',
    ReadWrite: 'read-write',
    Admin: 'admin'
} as const;
export type UserResponseRoleEnum = typeof UserResponseRoleEnum[keyof typeof UserResponseRoleEnum];

