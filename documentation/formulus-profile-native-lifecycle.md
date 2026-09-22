# Formulus profile database lifecycle: native implementation and research

Research updated: 2026-09-19. Source baselines: WatermelonDB **0.28.0**, React Native
**0.83.1** (the versions selected by this checkout). The existing
`documentation/` parent was verified before creating this document.

## Integration contract

`formulus/src/profiles/nativeProfileLifecycle.ts` exports:

```ts
export declare function prepareProfileDatabase(dbName: string): Promise<void>;
export declare function deleteProfileDatabase(dbName: string): Promise<boolean>;
export declare function isProfileDatabaseOpen(dbName: string): Promise<boolean>;
export declare function profileDatabaseExists(dbName: string): Promise<boolean>;
export declare function createProfileId(): Promise<string>;
export declare function restartProfileRuntime(): Promise<void>;
```

All methods use `NativeModules.UserAppModule` on Android and iOS. Missing native
support or another platform rejects; there is no silent success/no-op fallback.

- The migrated **Default keeps `dbName: 'formulus'` only when legacy evidence is
  detected**: a database/main sidecar entry, legacy app files, or legacy
  AsyncStorage state. Do not rename, move, copy, reset, or reconstruct an existing
  legacy database. An already persisted registry remains authoritative.
- A **fresh Default**, like every new profile, uses `formulus_<lowercase UUID>`:
  hexadecimal `8-4-4-4-12`, with
  hyphens. Display names are not database names. Paths, URI names, extensions,
  uppercase aliases, empty suffixes, whitespace, and trailing newlines reject in
  both JS and native code. UUID version/variant bits are not restricted.
- `profileDatabaseExists` calls native `databaseExists`. It returns true if **any**
  exact `.db`, `.db-journal`, `.db-wal`, or `.db-shm` entry exists, including an
  orphan sidecar. It only lists directory entries: it never reads a DB descriptor,
  opens SQLite, creates files, marks a name opened/retired, or selects a profile.
  False requires a successful listing with all four names absent. Uninspectable
  directories reject rather than imply a fresh install. A directory or even a
  dangling symlink with one of those exact names conservatively counts as evidence;
  this is not a database-health check or permission to open that entry. Cleanup
  still rejects non-regular entries. Results are a point-in-time filesystem
  observation, not proof of closure, and can be queried for prepared names too.
- `createProfileId` calls native `generateProfileId`, returning an unprefixed
  lowercase UUID. Android uses `java.util.UUID.randomUUID().toString()`; iOS uses
  `NSUUID.UUID.UUIDString.lowercaseString`. Both generate random v4 UUIDs without
  a JS random-number dependency. The wrapper validates the full lowercase
  `8-4-4-4-12` representation and rejects malformed native responses rather than
  normalizing them. Generation does not register a profile or create/open a DB;
  the registry owns collision checks and persistence. See [Java UUID](<https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/UUID.html#randomUUID()>)
  and [Apple NSUUID](https://developer.apple.com/documentation/foundation/nsuuid).
- **Await `prepareProfileDatabase` before constructing any SQLiteAdapter.** JSI
  can open the database inside the adapter constructor, before its initialization
  promise resolves. This includes Default, retries, fallback adapters, background
  initialization, and future adapter entry points. Preparation marks the name
  before JS can initialize the adapter; it does not open SQLite or create files.
  Preparation is idempotent **only for the selected name in the same native
  helper/runtime**. Once **any** name has been prepared in the native process,
  every other preparation rejects with **`E_PROFILE_COLD_LAUNCH_REQUIRED`** on
  both platforms: another name in the same helper, any name in a replacement
  helper, and even a never-opened target B. This applies even if adapter setup
  failed or never started. Its message is: "A profile database has already been
  prepared in this app process. Fully close and reopen Formulus before switching
  profiles or reinitializing the runtime; a JavaScript reload is not sufficient."
  Rejection changes no selection, guard state, or files. Strict-name and
  retired/tombstone validation still apply before this gate.
- `isProfileDatabaseOpen` means **ever prepared in this native process**, not a
  query of actual SQLite handles. A failed initialization still remains guarded.
  **False for B is not permission to initialize B**: a prepared A also blocks B.
  Native preparation is the authoritative atomic gate. There is deliberately no
  `markClosed`, reset, or unregister API.
- `deleteProfileDatabase` returns **true only after all four exact filenames are
  confirmed absent**; it also succeeds when they were already absent. **False**
  means a prepared/opened name is protected until a real cold launch. Invalid
  names, unexpected file types, and filesystem errors reject. Do not confuse a
  rejected promise with successful deletion.
- Calls are synchronized process-wide across module instances. A name whose
  deletion was attempted while unopened is also retired for the rest of the
  process: preparation cannot race with deletion or reopen a partially deleted
  file set. Deletion can be retried. A deferred deletion does not retire a still
  running profile.
- Registry code owns durable tombstones. **Retain a tombstone on false or any
  exception, including partial filesystem deletion. Never reuse a deleted name.**
  Native retirement state is intentionally not a replacement for that registry.
- `restartProfileRuntime` is retained but **not used for profile switching in v1**.
  It is only a potential explicit bootstrap-error retry before any database was
  prepared. Once any preparation happened, its replacement runtime cannot prepare
  any profile. The API reloads RN, not the OS process, and acknowledges scheduling,
  not completion. Never put required cleanup after its promise or claim it
  automatically closes/relaunches the app.

### Required bootstrap/switch ordering (owned by the integrating agent)

1. Load/migrate the registry. If there is no registry, combine
   `await profileDatabaseExists('formulus')` with legacy app-file and AsyncStorage
   evidence **before** preparing any adapter. Preserve `formulus` if any evidence
   exists; otherwise generate an ID with `createProfileId()` and use
   `formulus_<id>` for the fresh Default. An existence error must stop/retry
   migration, not discard legacy identity. This helper does not inspect app files
   or AsyncStorage; that decision remains with the integrating agent.
2. Choose a non-tombstoned running profile and freeze its identity for this runtime.
3. Retry cleanup of inactive tombstones **before** adapter construction. Keep
   failed/deferred entries for the next bootstrap. Never select a tombstoned DB.
4. `isProfileDatabaseOpen(selectedName)` may detect that same name's prior use,
   but false cannot exclude another prepared name. Always await native
   preparation before constructing exactly one adapter; handle
   `E_PROFILE_COLD_LAUNCH_REQUIRED` by showing the localized cold-launch screen
   without initializing any profile UI/services. This also catches external/dev
   JS reloads after preparation, whether the selected target is A or an unused B.
   A same-runtime initialization retry must reuse its existing adapter/promise;
   idempotent preparation never authorizes a duplicate adapter.
5. Every profile switch uses the cold-launch UX below. After quiescing old work
   and committing target selection, **never call `restartProfileRuntime`** and
   never initialize the target in-process. This includes first visits to new
   profiles, not just returning to previously used ones.
6. Logical deletion requires the old profile to be inactive. Persist its tombstone
   according to registry policy, keep it until physical deletion succeeds, and
   retry cleanup on the **next real cold bootstrap before adapter preparation**.
   A leftover prepared name in a warm process still returns false from deletion.
   Opening the new selected DB must not precede this cold-start cleanup pass.

### Intended v1 user experience (implemented by the main profile flow)

1. The user chooses a different profile. Block repeated actions, finish or
   explicitly cancel edits and queued writes, and stop old-profile sync/work.
2. Persist the selected target durably. If that commit fails, report the failure
   without pretending the switch succeeded; retain the immutable running identity.
3. On successful commit, unmount **all profile UI**, including WebViews/forms,
   navigation and observers, and show only a localized **fully close and reopen
   Formulus** screen. The target is selected for the next launch, not running now.
   No old-profile action may resume behind that screen. There is no automatic
   restart and no button that merely reloads JS to complete the switch.
4. Background/foreground, navigation back, an Activity recreation, or a dev reload
   must not bypass this state. The user must actually terminate the native app
   process and launch it again. The new bootstrap reads persisted selection,
   retries inactive tombstones before any adapter, then prepares/opens the target.
5. If a bootstrap error happens **before any preparation**, an explicit RN retry
   remains technically possible. If preparation occurred (even failed setup), a
   replacement runtime must instead show the cold-launch screen. Do not retry
   native reload in a loop or use per-name `isProfileDatabaseOpen` as an escape.

The native files/wrapper provide the gate, not this localized UI. No main profile
flow files are changed by this native-scope work.

This patch supplies the primitives, not registry/UI/bootstrap integration. The
native opened-name set is not automatic instrumentation of WatermelonDB. An
adapter opened without preparation violates the safety contract; do not enable
cleanup until every production adapter constructor is gated. The model assumes
one app process owns these database paths, with no extension/secondary process
opening them and no unguarded filesystem writer. It is not a cross-process lock.

## Exact WatermelonDB 0.28 paths

For the permitted plain names (without `.db` in `dbName`):

| Platform/adapter      | Actual main-file location                                                                      | Upstream implementation                                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android JSI           | `context.getDatabasePath(dbName + ".db").getPath().replace("/databases", "")`                  | [JSIInstaller.java](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/android-jsi/src/main/java/com/nozbe/watermelondb/jsi/JSIInstaller.java), called by [DatabasePlatformAndroid.cpp](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/android-jsi/src/main/cpp/DatabasePlatformAndroid.cpp) |
| Android Java fallback | Same expression: normally `<app data>/<dbName>.db`, **not** `<app data>/databases/<dbName>.db` | [WMDatabase.java](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/android/src/main/java/com/nozbe/watermelondb/WMDatabase.java)                                                                                                                                                                      |
| iOS JSI               | App `NSDocumentDirectory/<dbName>.db`                                                          | [DatabasePlatformIOS.mm](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/ios/WatermelonDB/DatabasePlatformIOS.mm)                                                                                                                                                                                    |
| iOS ObjC fallback     | App `NSDocumentDirectory/<dbName>.db`                                                          | [WMDatabaseDriver.m](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/ios/WatermelonDB/objc/WMDatabaseDriver.m)                                                                                                                                                                                       |

Deletion addresses only `<dbName>.db`, `<dbName>.db-journal`,
`<dbName>.db-wal`, and `<dbName>.db-shm` in that directory. It does not glob,
recursively remove directories, call Android `Context.deleteDatabase` (wrong
location here), or touch another profile. It removes orphan sidecars even when
the main file is already absent. Existing symlinks/non-regular files are rejected
before any unlink. An unreadable/uninspectable directory is an error, not success.

The Android helper uses `java.io.File` APIs compatible with this app's minimum
Android API 24 rather than `java.nio.file` APIs introduced on API 26. The iOS
helper uses filesystem metadata and `unlink`, never recursive `removeItem`.
Neither implementation reads database contents or opens any SQLite engine.

## Connection ownership and teardown findings

Sources:

- [SQLiteAdapter constructor and public operations](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/src/adapters/sqlite/index.js)
- [Native/JSI dispatcher](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/src/adapters/sqlite/makeDispatcher/index.native.js)
- [JSI adapter creation, destruction hook, and internal unsafeClose](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/shared/DatabaseBridge.cpp)
- [Database::destroy / destructor](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/shared/Database.cpp)
- [SqliteDb::destroy / sqlite3_close](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/shared/Sqlite.cpp)
- [Android WMDatabaseBridge.invalidate](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/android/src/main/java/com/nozbe/watermelondb/WMDatabaseBridge.java)
- [Android native driver](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/android/src/main/java/com/nozbe/watermelondb/WMDatabaseDriver.java)
- [iOS native bridge](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/ios/WatermelonDB/objc/WMDatabaseBridge.m)

The JSI dispatcher calls `nativeWatermelonCreateAdapter` in its constructor.
That creates a C++ `Database` backed by `SqliteDb`. `Database::destroy` takes a
mutex, finalizes cached statements, and asks `SqliteDb` to close. The latter logs
`sqlite3_close` failures instead of supplying a reliable success result to JS.
JSI uses WAL; Android also sets `synchronous=FULL`. The Android Java fallback
opens with `ENABLE_WRITE_AHEAD_LOGGING`.

Watermelon has an **internal JSI `unsafeClose`**, but no public, portable
`SQLiteAdapter.close()`/`Database.close()` with an acknowledged all-connections
closed contract. Accessing `_dispatcher._db.unsafeClose` would couple app code
to private JSI internals, omit fallback connections, and not establish a safe
filesystem-deletion barrier. `unsafeResetDatabase` is destructive schema/data
reset, not lifecycle teardown, and is not used here.

Android's bridge `invalidate()` attempts to schedule its JSI destruction hook on
the JS queue; if that callback runs, it calls process-global native destroy
listeners. The Java
fallback driver has `close()`, but the bridge invalidation implementation does
not iterate its connection map and explicitly close those fallback drivers.
Do not assume dropping the JS singleton closes every native resource promptly.

On iOS the Watermelon JSI early-close hook listens for
`RCTBridgeWillReloadNotification`. RN 0.83's bridgeless `RCTHost` uses instance
invalidation rather than that legacy bridge notification. Normal C++ destruction
is still present, but that old notification must not be treated as proof of
bridgeless close timing. We do not manually broadcast it or call private close
methods from the main thread. Upstream `DatabaseBridge.cpp` itself warns about
asynchronous invalidation overlapping new bridge setup.

**Retaining the old JS adapter/services while mounting a new profile is not a
safe switch implementation.** It preserves writers, observers, native handles,
and stale profile identity. An idle retained connection to a different database
is not by itself proof of corruption, but it is also not evidence that files
are safe to delete. Reopening the same file while an older connection is still
active is especially concerning with exclusive locks or different SQLite copies.
The retained host-reload primitive requests runtime disposal rather than merely
remounting UI, but does **not** establish a verified, synchronous all-Watermelon-
handles-closed barrier. V1 therefore does not use it for switching profiles.
Static guards remain even after apparent closure; only process death allows the
next profile runtime to initialize.

### Enforced v1 limitation: every profile switch requires a real cold launch

**No warm A → B is allowed, even if B was never opened.** Once A is prepared,
only A's original helper can idempotently repeat A. That helper cannot select B,
and no replacement helper can select A, B, or C, regardless of how many JS reloads
occur. `E_PROFILE_COLD_LAUNCH_REQUIRED` is returned before any new name is selected
or file is touched. This covers failed/not-yet-started adapter setup too. A true
cold launch can initialize B; returning from B to A requires another cold launch.

The non-empty static set is a **process-wide preparation veto**, with only the
original helper/name's idempotent exception. It is also a per-name **deletion
veto**. It is not a SQLite handle detector/reference count. It deliberately remains
conservative even if a connection actually closed. Process death clears it; a
JS reload, activity recreation, time delay, or changing the registry does not.
There is no clear/markClosed escape hatch. This implementation does not perform
an automatic full process restart: the user must fully close and relaunch the
app. Returning from the background is not a cold launch.

Repeated preparation of A in one runtime does not authorize creating multiple
adapters: bootstrap must still construct exactly one adapter, and old JS
adapters must never be retained across profile switches.

Each call to `nativeWatermelonCreateAdapter` creates a **new C++ Database and
`sqlite3_open` handle**; there is no JSI name-based reuse/deduplication. Normally
runtime disposal releases the old JS host object and closes that connection. The
source review does not establish a successful close barrier for this app:

- Android's host calls `ReactInstance.destroy()` before creating its replacement.
  However, [ReactInstance.destroy](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactInstance.kt)
  calls `reactQueueConfiguration.destroy()` **before** TurboModule invalidation.
  [ReactQueueConfigurationImpl.destroy](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/bridge/queue/ReactQueueConfigurationImpl.kt)
  quits the JS queue synchronously. Watermelon's invalidation hook then attempts
  to schedule early closure onto that JS queue. Therefore that hook cannot be
  treated as a guaranteed successful close on RN 0.83; normal native/runtime
  destruction must also be investigated. The Java fallback's missing explicit
  close iteration is a separate concern.
- On iOS, `RCTInstance.invalidate()` schedules destruction on its JS thread, while
  `RCTHost` immediately creates a replacement instance. The legacy Watermelon
  early-close notification is not a bridgeless completion barrier. Slow invalidation
  or retained references can overlap a new runtime; spending time in B is not a
  synchronization mechanism that proves A closed before returning to A.
- `SqliteDb::destroy()` marks itself destroyed, calls `sqlite3_close`, and merely
  logs failures. It even logs `Database closed.` after the error branch. **That
  log line alone is not evidence of successful closure.** A leaked live connection
  and a later JSI or system-SQLite fallback opening A are possible concerns, not
  failures demonstrated by the standalone tests here.

Multiple handles from the same correctly configured SQLite library are not
inherently corruption. Nevertheless stale work, exclusive locking, fallback
between bundled/system engines, failed closure, and the engine's WAL-reset bug
make an unverified overlap unacceptable to claim as corruption-free. The static
guard prevents this module from unlinking a prepared DB and prevents conforming
replacement runtimes from preparing **any** DB once one was prepared. It does
not prevent every possible SQLite corruption cause.

Safeguards and release decision:

1. Freeze running identity, serialize switches, quiesce all writers/sync and
   observers, unmount profile UI, and require actual process termination before
   target initialization. Never retain/reuse an old JS
   adapter, use `experimentalUnsafeNativeReuse` as a fix, or bypass a lock error
   by opening the same DB through another engine.
2. Do not checkpoint, inspect, open/close, or "repair" a live Watermelon file via
   a separate SQLite connection/engine. Neither existence checks nor UUID
   generation creates such a connection. No sidecar removal on warm reload.
3. Test A → B → A in **release**, including forced fallback, background transitions,
   migrations/setup failure, and native close failures. The expected outcome is
   **no warm adapter initialization for either switch**, followed by successful
   target initialization only after each true cold launch. Instrument actual open/close
   handle identity and close return values in a development test build. A clean
   UI reload or helper-test pass is insufficient. If needed, run integrity checks
   through the owning adapter after quiescence, not an independent live engine.
4. **The intentional v1 policy requires a real cold launch for every profile
   switch and every replacement runtime after preparation, regardless of apparent
   native closure.** Do not weaken this based on
   log messages or time spent in another profile. A future relaxation would need
   a separately implemented, acknowledged, version-pinned Watermelon teardown
   barrier covering JSI and fallback.

### Global destroy hooks: distinct database names are not the whole problem

A separate **source-level unsafe interleaving** exists in Watermelon 0.28's Android
JSI lifecycle. [DatabasePlatformAndroid.cpp](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/android-jsi/src/main/cpp/DatabasePlatformAndroid.cpp)
has one process-global `destroyListeners` vector. `onDestroy` appends to it;
`destroy` invokes **every listener**, then clears the vector. Neither function
filters by runtime, bridge, or DB name, and neither locks that vector.
[JSIInstaller.cpp](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/android-jsi/src/main/cpp/JSIInstaller.cpp)
routes `JSIInstaller.destroy()` directly to it. Each callback in
[DatabaseBridge.cpp](https://github.com/Nozbe/WatermelonDB/blob/v0.28.0/native/shared/DatabaseBridge.cpp)
holds a weak reference to its own Database, but only checks whether that object
still exists; it does not check which runtime requested destruction.

Consequently, **if an old runtime's destroy call arrives after new B registers**,
that old call can destroy live B too. Concurrent registration/destruction would
also race on the vector. This risk is independent of A and B having different
filenames, so a guard that blocked only revisits would not fix it. This is a concrete hazardous
ordering in the dependency source, **not a reproduced failure of this app's
single-host RN 0.83 reload path**. RN's Android host orders instance destruction
before replacement creation and synchronously shuts down its JS queue; that
limits overlap but also raises the dropped-early-close-hook concern above. Do not
infer from either observation that arbitrary delayed/headless/multiple-runtime
callbacks are safe.

On iOS, `onDestroy` registers for `RCTBridgeWillReloadNotification` with
`object:nil` and `queue:nil`. A notification would invoke callbacks for every
registered live Database, not just one host. The current bridgeless reload does
not rely on that legacy notification; **do not manually emit it to "fix" close
ordering**, especially once replacement setup could be running.

**V1 decision: no warm first visits, and no warm revisits.** The native gate now
blocks all replacement-runtime database preparation once the process has prepared
any name. Main transitions must not create a replacement profile runtime at all;
they persist selection and show the cold-launch screen. This avoids relying on
unverified global-hook ordering between old and new profile databases. Keep a
single host and do not manually invoke Watermelon's destroy hooks. Any future warm
switch support would require a separate runtime-scoped hook fix and acknowledged
teardown barrier, not a delay, separate SQLite checkpoint connection, or distinct
names. These tests do not execute upstream hooks or establish corruption immunity.

## SQLite official safety guidance

- [How To Corrupt: deleting a hot journal / mispairing files (§1.3–1.4)](https://www.sqlite.org/howtocorrupt.html#delhotjrnl)
- [How To Corrupt: POSIX close(), multiple SQLite copies, unlink/rename while in use (§2.2–2.5)](https://www.sqlite.org/howtocorrupt.html)
- [WAL: the WAL file is persistent database state (§4)](https://www.sqlite.org/wal.html#the_wal_file)
- [WAL: automatic checkpointing and last-connection closure (§3.1, §6)](https://www.sqlite.org/wal.html)

SQLite explicitly warns against unlinking or renaming an open DB, independently
removing hot journals/WAL from a database being retained, and independently
opening/closing a live DB through another SQLite copy. POSIX file-close locking
semantics can interfere with other connections. Thus this module does not open
system SQLite to probe a bundled Watermelon connection, checkpoint it, or attempt
to determine whether it is busy. It does not read the SQLite header either.

SQLite's WAL guidance to open/close through SQLite to safely remove a WAL applies
to preserving/recovering the database, **not a reason to introduce another engine
here**. Our operation deliberately destroys the entire tombstoned database file
set only when it could not have been opened by a conforming adapter in this
process. A hot journal left by a crash is retained for recovery for every
non-deleted profile. For a tombstoned profile, the entire data set is intentionally
discarded, with the registry preventing reopening after partial deletion.

The current official WAL page also documents the **WAL-reset bug**, fixed in
SQLite 3.51.3 (backports 3.44.6 and 3.50.7). The app's pinned `@nozbe/sqlite`
3.46.0 predates those fixes. Upgrading/reviewing that dependency is a separate
follow-up; this patch does not alter dependencies or claim to fix that engine bug.

## Retained RN reload primitive (not used for v1 profile switching)

`restartProfileRuntime` remains exported for an explicit bootstrap retry before
any database preparation. It is not a full app restart, never clears native
guards, and cannot make any profile preparable after a database was prepared.
The implementation is retained, not relied upon for switching.

### Android

The app already owns a `ReactHost` in `MainApplication`. `UserAppModule` calls
`ReactHost.reload("Formulus bootstrap retry")` on the UI thread. The
[public ReactHost contract](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactHost.kt)
and [ReactHostImpl reload pipeline](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactHostImpl.kt)
show surface stopping, context destruction, `ReactInstance.destroy()`, new
instance creation, and restarting attached surfaces. This path is not gated by
developer support; async failures are handled by the host's error handling.
`Activity.recreate()` alone is insufficient because the application host can
retain the JS runtime. No process-killing/relaunch intent trick is used.

### iOS

The new ObjC `UserAppModule` is explicitly registered in the Formulus Xcode
Sources build phase using `RCT_EXPORT_MODULE`. It dispatches
`RCTTriggerReloadCommandListeners` on the main queue:

- [RCTReloadCommand implementation](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/React/Base/RCTReloadCommand.m): dispatch to listeners is not `RCT_DEV`-gated.
- [RCTHost](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/ReactCommon/react/runtime/platform/ios/ReactCommon/RCTHost.mm): registers as a reload listener; the command invokes `_reloadWithShouldRestartSurfaces:YES`, invalidates the old instance, creates another, and restarts attached surfaces.
- [RCTInstance.invalidate](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/ReactCommon/react/runtime/platform/ios/ReactCommon/RCTInstance.mm): suspends the surface presenter, schedules TurboModule invalidation/resource destruction on the JS thread, and terminates that JS thread.
- [RCTRootViewFactory](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/Libraries/AppDelegate/RCTRootViewFactory.mm): owns/starts the `RCTHost` used by the existing AppDelegate/SceneDelegate factory setup.

This is actual host/runtime invalidation, not a view remount, and does not use
`exit()` or depend on Metro. iOS invalidation is asynchronous and may overlap
replacement startup. There is no completion callback to infer that every SQLite
handle has closed. In particular, **neither restart path clears the native opened
set**. Do not confuse this with a real OS process restart.

[DevSettings.reload in RN 0.83.1](https://github.com/facebook/react-native/blob/v0.83.1/packages/react-native/Libraries/Utilities/DevSettings.js)
is a no-op outside `__DEV__`, so it is intentionally not used.

## Validation and remaining device work

### Standalone native contract tests

No Android SDK, React Native dependencies, Pods, or added test dependencies are
needed. These exercise the actual production filesystem/guard helper classes,
not a separate implementation. From `formulus/android/` (create the output
folder first):

```sh
javac -Xlint:all -d app/build/profile-lifecycle-tests app/src/main/java/org/opendataensemble/formulus/ProfileDatabaseLifecycle.java app/src/test/java/org/opendataensemble/formulus/ProfileDatabaseLifecycleTest.java
java -cp app/build/profile-lifecycle-tests org.opendataensemble.formulus.ProfileDatabaseLifecycleTest
```

From `formulus/ios/` on macOS (create the output folder first):

```sh
clang -fobjc-arc -fblocks -Wall -Wextra -Werror -framework Foundation Formulus/ProfileDatabaseLifecycle.m Tests/ProfileDatabaseLifecycleTests.m -o build/profile-lifecycle-tests/ProfileDatabaseLifecycleTests
build/profile-lifecycle-tests/ProfileDatabaseLifecycleTests
```

The suites cover strict names; all four suffixes and orphan WAL; neighboring
files; existence probes without preparation; 128 lowercase v4 UUIDs per platform;
I/O errors, symlinks/non-regular files and deletion retries. The all-switch policy
checks explicitly reject A → B in the same or replacement helper even when
`isDatabaseOpen(B)` is false, reject reload → A, retain original-helper A
idempotence, preserve files/selection after errors, and reject after preparation
before any adapter/file creation. Cold child processes clean tombstone files
before preparing legacy or UUID target names and cannot reset the parent's guard.

Each platform runs 64 races in separate fresh child processes: 32 prepare/delete,
16 two-helper same-name, and 16 two-helper **different-name** preparations. Only
one helper/name may win in a process. Fresh processes are required by the actual
production guard; tests do not clear static state or add a reset API. These tests
use ordinary filesystem fixtures, not shared live SQLite connections. The UUID
sample checks do not prove collisions impossible. The iOS suite is a standalone
macOS Foundation executable, not a simulator/device test. Neither suite validates
real RN module recreation, UI transitions, or Watermelon teardown.

A dependency-free Node 24 check stripped the wrapper's TypeScript syntax and
executed it against a mocked native bridge. It passed forwarding, strict-name
rejection, boolean deferred/success propagation, native error propagation, and
unsupported-platform/missing-module failures. The extended check also passed
existence forwarding without preparation, UUID forwarding/invalid-native-response
rejection, and missing-new-native-method failures on both platform branches. This
is not a real React Native integration test.

With dependencies subsequently available, the wrapper also passed:

```sh
# From formulus/, using installed tools without an implicit package install:
./node_modules/.bin/prettier src/profiles/nativeProfileLifecycle.ts --check
./node_modules/.bin/eslint src/profiles/nativeProfileLifecycle.ts
./node_modules/.bin/tsc --noEmit --skipLibCheck --strict --target esnext --module esnext --moduleResolution bundler src/profiles/nativeProfileLifecycle.ts
```

This is targeted wrapper typechecking, not the entire app's typecheck.

`plutil -lint formulus/ios/Formulus.xcodeproj/project.pbxproj` and
`git diff --check` passed. Full RN app native builds were not run. Pods remain
absent and only macOS Command Line Tools (not full Xcode) are selected. The
standalone JVM tests do not compile the Kotlin RN bridge; the macOS Foundation
tests do not compile the iOS RN module. The initial pnpm lint/format attempt
(before dependencies were available) timed out during dependency resolution;
subsequent direct installed-tool validation above passed.

### Practical manual native rebuild (not just Metro reload)

After installing the package dependencies and platform toolchains described in
`formulus/README.md`, run these from **`formulus/`** with Metro stopped. Native
methods require rebuilding/reinstalling the binary; JS reload cannot add them.
Use a test device/backup before testing deletion. Install over the existing build
with compatible signing to test migration; do **not** uninstall or clear app data.

```sh
# Android: connected ARM device, SDK/JDK installed.
# The preandroid script vendors Notifee and applies the required Android patches.
pnpm run android --mode release --no-packager

# iOS: full Xcode selected and a simulator installed.
bundle install
(cd ios && bundle exec pod install)
pnpm run ios --mode Release --scheme Formulus --no-packager
```

The `--mode`, `--scheme` (iOS), and `--no-packager` flags were verified with the
installed CLI's `run-android --help` / `run-ios --help`; these rebuild commands
were **not executed here**. Use the CLI's `--device` option for iOS device testing
with signing configured. For an Android build without installation, after the
Notifee vendor/patch steps use `(cd android && ./gradlew :app:assembleRelease)`.

### Required before shipping

- Build/run **release** Android and iOS with Metro stopped. Verify the native
  methods are registered in bridgeless mode, persisted profile selection loads,
  switches do not call native reload, and old profile UI/services cannot issue work
  after the selection commit/unmount.
- On both platforms test a DB-only legacy install, an orphan sidecar-only install,
  legacy-file-only and AsyncStorage-only installs, and a fresh install. Confirm
  only detected legacy Default retains `formulus`; fresh Default uses a generated
  UUID name. An unreadable existence probe must not silently choose fresh Default.
  Inspect the version-pinned paths and ensure existing Default data is unchanged.
- Exercise real JSI and deliberately forced fallback adapters. Every switch,
  including first-time A → B, must persist selection, unmount all profile UI and
  show the localized cold-launch screen without calling native reload. Neither
  same-process target preparation nor automatic full restart is allowed. Force
  an external/dev reload and confirm native preparation rejects both the old name
  and a never-opened target. Fully terminate/relaunch; only then may the persisted
  target open, after tombstone cleanup. Include setup failure, writes/sync/
  attachments in flight, rapid requests and background transitions.
- Verify active deletion returns false and leaves all files untouched, including
  after JS reload. Also verify a just-prepared DB whose setup fails is protected.
- Switch away, tombstone the old profile, confirm warm-start cleanup remains
  deferred, then actually terminate the app process and relaunch. Confirm cleanup
  occurs before any adapter opens that name and removes all four files before the
  registry drops the tombstone.
- Simulate process death and I/O failure partway through file cleanup; confirm the
  registry retries without reopening the tombstoned name. Verify startup never
  selects a tombstone even if only sidecars remain.
- Exercise background/resume, failed selection commits, repeated switch requests,
  external reloads, and Android API 24. The cold-launch screen must not expose old
  profile actions or dismiss back to live UI. Test the retained RN retry only for
  pre-preparation bootstrap errors; no retry loop may bypass the cold gate.
- Confirm all adapter entry points (including any future headless service or
  secondary process) respect preparation and the single-owner assumption.

This work concerns native database/runtime lifecycle only. It makes **no browser,
WebView cookie, localStorage, IndexedDB, cache, or browser-storage isolation
claim**. Those require separate design and validation.
