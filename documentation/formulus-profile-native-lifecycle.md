# Formulus profile database lifecycle: native implementation and research

Source baselines: WatermelonDB **0.28.0**, React Native **0.83.1**. This document
covers the current in-app profile flow as well as the native lifecycle helpers;
source review and standalone tests do not substitute for release-device testing.

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
  Preparation is idempotent per name, including across native module instances;
  **distinct names may also be prepared in the same process**. It does not
  assert that an adapter initialized successfully or that its handle closed.
  Strict-name and retired-name validation still apply.
- `isProfileDatabaseOpen` means **ever prepared in this native process**, not a
  query of actual SQLite handles. A failed initialization still remains guarded.
  False for B means only that B has not been prepared in this process; it does
  not prove B is safe to open, or that A is closed. There is deliberately no
  `markClosed`, reset, or unregister API.
- `deleteProfileDatabase` returns **true only after all four exact filenames are
  confirmed absent**; it also succeeds when they were already absent. **False**
  means that name was prepared in this process and cannot be deleted until a
  real cold launch. Invalid names, unexpected file types, and filesystem
  errors reject. Do not confuse a
  rejected promise with successful deletion.
- Calls are synchronized process-wide across module instances. A name whose
  deletion was attempted while unopened is also retired for the rest of the
  process: preparation cannot race with deletion or reopen a partially deleted
  file set. Deletion can be retried. A deferred deletion does not retire a still
  running profile.
- Registry code owns durable tombstones. **Retain a tombstone on false or any
  exception, including partial filesystem deletion. Never reuse a deleted name.**
  Native retirement state is intentionally not a replacement for that registry.
- `restartProfileRuntime` is retained for a possible explicit bootstrap-error
  retry before database preparation, **not profile switching**. It reloads RN,
  not the OS process, and acknowledges scheduling, not completion. Prepared-name
  guards survive reload; a reload is not a verified SQLite-close barrier. Never
  put required cleanup after its promise.

### Bootstrap and switch ordering

1. Load/migrate the registry. If there is no registry, combine
   `await profileDatabaseExists('formulus')` with legacy app-file and AsyncStorage
   evidence **before** preparing any adapter. Preserve `formulus` if any evidence
   exists; otherwise generate an ID with `createProfileId()` and use
   `formulus_<id>` for the fresh Default. An existence error must stop/retry
   migration, not discard legacy identity. This helper does not inspect app files
   or AsyncStorage; that decision remains with the integrating agent.
2. At bootstrap, check every recorded live and tombstoned name with
   `isProfileDatabaseOpen` before migration or cleanup. A detected prepared name
   stops bootstrap with `E_PROFILE_COLD_LAUNCH_REQUIRED` and the localized
   close/reopen screen: a JS reload cannot safely reconstruct the JS adapter map.
3. Retry tombstone cleanup before constructing an adapter. Keep failed/deferred
   tombstones for a later cold bootstrap; never select a tombstoned DB.
4. Await native preparation before constructing an adapter. `database.ts` caches
   the initialization promise and retains one WatermelonDB `Database` per visited
   profile ID for the lifetime of the JS runtime. Revisits select that instance;
   they must not reopen the same SQLite name. Failed setup is not retried in the
   same runtime because it may have left native handles.
5. A switch unmounts the profile subtree (including WebViews) and quiesces work,
   creates the destination's directories, persists selection, then selects the
   target runtime and initializes its DB in-process (or reuses its retained
   instance), invalidates profile service caches and remounts. It does **not**
   call `restartProfileRuntime`, reload JS, or use a WatermelonDB close patch.
   On a post-commit error (ambiguous registry write or failed destination open)
   the coordinator rereads the durable registry and resumes in-app only against
   a profile whose retained DB is healthy or was never opened; a failed adapter
   is never retried in the same runtime. If the durable selection cannot be
   opened and the previous profile is healthy and still registered, it is
   reselected. Otherwise the UI stays on a fail-closed recovery screen.
6. Deletion persists a tombstone and switches away if needed. A prepared name
   remains protected from physical deletion even after switching away. Cleanup
   runs at a later cold bootstrap, before adapter preparation, and keeps the
   tombstone on false or error; a warm switch does not clear native guards.

### Current user experience and limits

A successful in-app switch returns to the target profile without an app or JS
restart. An open form/native picker blocks the unmount rather than being silently
lost. If commit or target initialization fails after commit was attempted, the
profile root shows a brief “restoring” state while the coordinator rereads the
registry; it resumes a provably safe profile or stays on the recovery screen.
Formplayer is the app-owned bundled build on both platforms (never copied per
profile); on iOS its WebView read grant covers the common ancestor of the bundle
and Documents so profile attachments render. Profiles are **not** a security
boundary for code supplied by a server or custom app.
A JS reload after preparation is different: bootstrap sees prepared names and
shows the localized close/reopen screen; an actual process restart is needed to
reconstruct a fresh runtime and to retry deferred cleanup.

The native opened-name set is not automatic instrumentation of WatermelonDB.
Every production adapter constructor must be gated by preparation; the model
assumes one app process owns these database paths, with no extension/secondary
process or unguarded filesystem writer. It is not a cross-process lock or a
verified close barrier. Retained adapters may remain open while other profiles
run; no corruption-free guarantee follows from distinct filenames.

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

### Retained adapters and native deletion veto

The current in-app switch retains the old WatermelonDB instance and selects a
new instance for B on first visit, or the retained instance on a revisit. The
profile subtree is unmounted and profile work quiesced before selection; retaining
an adapter is **not** evidence that native handles have closed, nor does it prove
all stale references or native work are harmless. Reopening a visited SQLite name
with a second adapter is avoided by the per-profile JS map, not by native
preparation (which is idempotent). A failed setup is not retried in that runtime.

The native static set is a **per-name deletion veto**, not a process-wide
preparation veto or SQLite handle detector/reference count. Multiple distinct
names may be prepared. Once a name is prepared, its files cannot be deleted by
this helper for the process lifetime, even if it is no longer selected or adapter
setup failed. Process death clears the set; JS reload, activity recreation, time
or registry changes do not. There is no `markClosed` escape hatch. Registry
bootstrap rejects a JS reload if any recorded name was prepared, before it can
create a duplicate adapter in the replacement JS runtime.

Each call to `nativeWatermelonCreateAdapter` creates a **new C++ Database and
`sqlite3_open` handle**; there is no JSI name-based reuse/deduplication. Normal
in-app switches do not dispose the JS runtime; retained instances stay alive.
On an external reload, runtime disposal may release the old JS host object and
close its connection, but source review does not establish a successful close
barrier for this app:

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
mean the in-app switch cannot be claimed corruption-free from source review.
The static guard prevents this helper from unlinking **prepared names**; it does
not prevent all possible SQLite corruption or prove quiescence.

Safeguards and release checks:

1. Serialize switches, block open forms/pickers, quiesce writers/sync and
   observers, unmount profile UI, then select the destination's retained adapter
   or construct it once. Do not use `experimentalUnsafeNativeReuse`, manually
   close through private Watermelon APIs, or bypass a lock error with another engine.
2. Do not checkpoint, inspect, open/close, or "repair" a live Watermelon file via
   a separate SQLite connection/engine. Neither existence checks nor UUID
   generation creates such a connection. No sidecar removal on warm switches.
3. Test A → B → A in **release**, including JSI/fallback, background transitions,
   migrations/setup failures, in-flight work and native handle behavior. The
   expected path is warm first-visit B and retained A on return, with no duplicate
   A adapter. Instrument actual handle identity and close return values in a
   development build where feasible. A clean UI transition or helper-test pass
   is insufficient. If needed, run integrity checks via the owning adapter after
   quiescence, not an independent live engine.
4. A fresh JS runtime after preparation is **not** an in-app switch: bootstrap
   requires a real cold launch rather than reconstructing adapters against names
   already prepared in the native process.

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
filenames; retaining instances without reloading avoids this particular
reload ordering on normal switches. This is a concrete hazardous ordering in
the dependency source, **not a reproduced failure of this app's
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

The current flow does **not** reload RN between profiles or manually invoke
Watermelon's destroy hooks. That avoids a reload-triggered teardown during a
normal switch, but does not establish safe ordering for external/dev reloads,
headless or multiple runtimes, or prove retained connections cannot interfere.
Keep a single host; test native JSI and fallback behavior on devices. Distinct
names alone are not a teardown guarantee, and these helper tests do not execute
upstream hooks or establish corruption immunity.

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
follow-up; these lifecycle helpers do not fix that engine bug.

## Retained RN reload primitive (not used for profile switching)

`restartProfileRuntime` remains exported for a possible explicit bootstrap retry
before database preparation. It is not a full app restart and never clears native
prepared-name guards. It is not used for switching; after preparation, a new JS
runtime cannot safely reconstruct the retained adapter map and registry bootstrap
shows the cold-launch screen. Native preparation itself still permits distinct
names; the reload restriction belongs to bootstrap, not the native guard.

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
handle has closed. In particular, **neither restart path clears the native
prepared-name set**. Do not confuse this with a real OS process restart.

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
I/O errors, symlinks/non-regular files and deletion retries. The current native
contract permits A and B to be prepared by the same or separate helpers,
repeats A idempotently, and vetoes deletion of **either**
prepared name (including after module replacement). Cold child processes clean
tombstone files before preparing legacy or UUID target names and cannot reset
the parent's guard.

Each platform runs 64 races in separate fresh child processes: 32 prepare/delete,
16 two-helper same-name, and 16 two-helper **different-name** preparations.
Different names can both prepare; neither prepared name can be deleted in that
process. Fresh processes test process-scoped state without adding a reset API.
These tests use ordinary filesystem fixtures, not shared live SQLite connections. The UUID
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
  in-app switches do not call native reload, and old profile UI/services cannot
  issue work after the selection commit/unmount.
- On both platforms test a DB-only legacy install, an orphan sidecar-only install,
  legacy-file-only and AsyncStorage-only installs, and a fresh install. Confirm
  only detected legacy Default retains `formulus`; fresh Default uses a generated
  UUID name. An unreadable existence probe must not silently choose fresh Default.
  Inspect the version-pinned paths and ensure existing Default data is unchanged.
- Exercise real JSI and deliberately forced fallback adapters. Test first-time
  A → B, returning B → A, and repeated visits: switch in-app without JS reload,
  keep one WatermelonDB instance per visited profile, and do not reopen A on
  return. Verify WebViews unmount and old-profile work stops before selection.
  Force an external/dev reload after preparation and confirm registry bootstrap
  shows the close/reopen screen rather than creating a second adapter. Fully
  terminate/relaunch and confirm tombstone cleanup precedes adapter construction.
  Include setup failure, writes/sync/attachments in flight, rapid requests and
  background transitions.
- Verify active deletion returns false and leaves all files untouched, including
  after JS reload. Also verify a just-prepared DB whose setup fails is protected.
- Switch away, tombstone the old profile, confirm cleanup of its prepared DB
  remains deferred, then actually terminate the app process and relaunch. Confirm
  cleanup occurs before adapter construction and removes all four files before
  registry marks native cleanup complete. Check non-DB profile data cleanup
  and retention of incomplete tombstones on partial failure.
- Simulate process death and I/O failure partway through file cleanup; confirm the
  registry retries without reopening the tombstoned name. Verify startup never
  selects a tombstone even if only sidecars remain.
- Exercise background/resume, failed selection commits, repeated switch requests,
  external reloads, and Android API 24. Recovery and cold-launch screens must not
  expose old profile actions or dismiss back to live UI. Test any retained RN
  retry only for pre-preparation bootstrap errors; no retry loop may bypass the
  registry's cold-launch preflight.
- Confirm all adapter entry points (including any future headless service or
  secondary process) respect preparation and the single-owner assumption.

**WebView isolation remains a separate risk:** unmounting both WebViews is not
proof that cookies, localStorage, IndexedDB, caches or origin-scoped state are
partitioned by profile. Review shared origins and namespaces for custom apps and
Formplayer, and manually test A → B → A for data/session leakage on both platforms.
Neither the native guard nor retained DB instances provide browser-storage
isolation. No end-to-end native/browser validation is claimed here.
