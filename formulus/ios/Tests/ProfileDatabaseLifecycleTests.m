#import "../Formulus/ProfileDatabaseLifecycle.h"

// Standalone Foundation tests: run on macOS without React Native, Pods, or an XCTest target.
static void Check(BOOL condition, NSString *message) {
  if (!condition) {
    NSLog(@"FAIL: %@", message);
    exit(1);
  }
}

static NSString *Name(void) {
  return [@"formulus_" stringByAppendingString:[ProfileDatabaseLifecycle generateProfileId]];
}

static NSString *Path(NSString *root, NSString *name, NSString *suffix) {
  return [root stringByAppendingPathComponent:[name stringByAppendingString:suffix]];
}

static NSArray<NSString *> *Suffixes(void) {
  return @[@".db", @".db-journal", @".db-wal", @".db-shm"];
}

static void Write(NSString *path) {
  Check([@"preserve me" writeToFile:path atomically:NO encoding:NSUTF8StringEncoding error:NULL], @"Fixture write");
}

static void CreateFiles(NSString *root, NSString *name) {
  for (NSString *suffix in Suffixes()) Write(Path(root, name, suffix));
}

static void ExpectColdLaunch(ProfileDatabaseLifecycle *lifecycle, NSString *name) {
  NSError *error = nil;
  Check(![lifecycle prepareDatabase:name error:&error], @"Preparation must require a cold launch");
  Check(error.code == ProfileDatabaseErrorColdLaunchRequired, @"Explicit cold-launch error required");
  Check([error.localizedDescription containsString:@"Fully close and reopen Formulus"], @"Cold-launch action missing");
  Check([error.localizedDescription containsString:@"JavaScript reload is not sufficient"], @"Reload limitation missing");
}

static void RunFresh(const char *executable, NSArray<NSString *> *arguments) {
  NSTask *task = [NSTask new];
  task.executableURL = [NSURL fileURLWithPath:[NSString stringWithUTF8String:executable]];
  task.arguments = arguments;
  Check([task launchAndReturnError:NULL], @"Launch fresh-process test case");
  [task waitUntilExit];
  Check(task.terminationStatus == 0, [@"Fresh-process case failed: " stringByAppendingString:arguments.description]);
}

static void RaceDeletion(NSString *root) {
  NSString *raced = Name();
  CreateFiles(root, raced);
  ProfileDatabaseLifecycle *opener = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
  ProfileDatabaseLifecycle *cleaner = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
  __block BOOL prepared = NO;
  __block NSNumber *deleted = nil;
  dispatch_group_t group = dispatch_group_create();
  dispatch_queue_t queue = dispatch_get_global_queue(QOS_CLASS_DEFAULT, 0);
  dispatch_group_async(group, queue, ^{ prepared = [opener prepareDatabase:raced error:NULL]; });
  dispatch_group_async(group, queue, ^{ deleted = [cleaner deleteDatabase:raced error:NULL]; });
  dispatch_group_wait(group, DISPATCH_TIME_FOREVER);
  Check(deleted != nil && prepared != deleted.boolValue, @"Prepare and delete mutually exclusive");
  Check([NSFileManager.defaultManager fileExistsAtPath:Path(root, raced, @".db")] == prepared, @"Opened file was deleted");
}

static void RacePreparation(NSString *root, BOOL sameName) {
  NSString *firstName = Name();
  NSString *secondName = sameName ? firstName : Name();
  ProfileDatabaseLifecycle *first = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
  ProfileDatabaseLifecycle *second = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
  __block BOOL firstPrepared = NO;
  __block BOOL secondPrepared = NO;
  __block NSError *firstError = nil;
  __block NSError *secondError = nil;
  dispatch_group_t group = dispatch_group_create();
  dispatch_queue_t queue = dispatch_get_global_queue(QOS_CLASS_DEFAULT, 0);
  dispatch_group_async(group, queue, ^{ firstPrepared = [first prepareDatabase:firstName error:&firstError]; });
  dispatch_group_async(group, queue, ^{ secondPrepared = [second prepareDatabase:secondName error:&secondError]; });
  dispatch_group_wait(group, DISPATCH_TIME_FOREVER);
  Check(firstPrepared != secondPrepared, @"Only one helper/name may win in a process");
  Check((firstPrepared ? secondError : firstError).code == ProfileDatabaseErrorColdLaunchRequired, @"Racing loser needs cold launch");
  ProfileDatabaseLifecycle *winner = firstPrepared ? first : second;
  ProfileDatabaseLifecycle *loser = firstPrepared ? second : first;
  NSString *winningName = firstPrepared ? firstName : secondName;
  NSString *losingName = firstPrepared ? secondName : firstName;
  Check([winner prepareDatabase:winningName error:NULL], @"Winner remains idempotent");
  ExpectColdLaunch(loser, losingName);
  if (!sameName) {
    Check([[loser isDatabaseOpen:losingName error:NULL] isEqual:@NO], @"Rejected different name stays unmarked");
    ExpectColdLaunch(winner, losingName);
  }
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSFileManager *files = NSFileManager.defaultManager;
    NSString *root = [NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
    Check([files createDirectoryAtPath:root withIntermediateDirectories:YES attributes:nil error:NULL], @"Temp directory");
    ProfileDatabaseLifecycle *lifecycle = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
    // Each race needs a real fresh process; there is intentionally no reset hook.
    if (argc == 2 && strncmp(argv[1], "--race-", 7) == 0) {
      if (strcmp(argv[1], "--race-delete") == 0) RaceDeletion(root);
      else RacePreparation(root, strcmp(argv[1], "--race-same") == 0);
      Check([files removeItemAtPath:root error:NULL], @"Clean race fixtures");
      return 0;
    }
    if (argc == 2 && strcmp(argv[1], "--cold-check") == 0) {
      Check([[lifecycle isDatabaseOpen:@"formulus" error:NULL] isEqual:@NO], @"Fresh process has no opened names");
      CreateFiles(root, @"formulus");
      Check([[lifecycle databaseExists:@"formulus" error:NULL] isEqual:@YES], @"Cold-process existence sees Default");
      Check([[lifecycle isDatabaseOpen:@"formulus" error:NULL] isEqual:@NO], @"Existence does not mark Default opened");
      Check([[lifecycle deleteDatabase:@"formulus" error:NULL] isEqual:@YES], @"Unopened migrated Default can be deleted");
      Check([[lifecycle databaseExists:@"formulus" error:NULL] isEqual:@NO], @"Deleted database does not exist");
      Check([files contentsOfDirectoryAtPath:root error:NULL].count == 0, @"All Default files absent");
      [files removeItemAtPath:root error:NULL];
      return 0;
    }

    if (argc == 3 && strcmp(argv[1], "--cold-prepare") == 0) {
      NSString *previouslyPrepared = [NSString stringWithUTF8String:argv[2]];
      NSString *tombstone = Name();
      CreateFiles(root, tombstone);
      Check([[lifecycle deleteDatabase:tombstone error:NULL] isEqual:@YES], @"Cold bootstrap cleans tombstones before preparing");
      Check([[lifecycle databaseExists:tombstone error:NULL] isEqual:@NO], @"All tombstone files absent");
      Check([[lifecycle isDatabaseOpen:previouslyPrepared error:NULL] isEqual:@NO], @"Fresh process allows selected name");
      CreateFiles(root, previouslyPrepared);
      Check([lifecycle prepareDatabase:previouslyPrepared error:NULL], @"Fresh-process preparation succeeds");
      Check([lifecycle prepareDatabase:previouslyPrepared error:NULL], @"Same-helper preparation stays idempotent");
      Check([[lifecycle deleteDatabase:previouslyPrepared error:NULL] isEqual:@NO], @"Prepared name defers deletion");
      for (NSString *suffix in Suffixes()) {
        Check([[NSString stringWithContentsOfFile:Path(root, previouslyPrepared, suffix) encoding:NSUTF8StringEncoding error:NULL]
               isEqual:@"preserve me"], @"Cold preparation leaves files intact");
      }
      ExpectColdLaunch([[ProfileDatabaseLifecycle alloc] initWithDirectory:root], previouslyPrepared);
      ExpectColdLaunch(lifecycle, Name());
      ExpectColdLaunch([[ProfileDatabaseLifecycle alloc] initWithDirectory:root], Name());
      [files removeItemAtPath:root error:NULL];
      return 0;
    }

    for (NSString *invalid in @[@"",  @"../formulus", @"formulus.db", @"formulus/other", @"formulus_",
                               @"FORMULUS", @"formulus\n", @"formulus\0", @"file:formulus",
                               @"formulus_01234567-89AB-CDEF-0123-456789ABCDEF"]) {
      NSError *error = nil;
      Check(![lifecycle prepareDatabase:invalid error:&error] && error.code == ProfileDatabaseErrorName, @"Invalid prepare");
      error = nil;
      Check(![lifecycle deleteDatabase:invalid error:&error] && error.code == ProfileDatabaseErrorName, @"Invalid delete");
      error = nil;
      Check(![lifecycle isDatabaseOpen:invalid error:&error] && error.code == ProfileDatabaseErrorName, @"Invalid query");
      error = nil;
      Check(![lifecycle databaseExists:invalid error:&error] && error.code == ProfileDatabaseErrorName, @"Invalid existence query");
    }

    NSMutableSet<NSString *> *ids = [NSMutableSet new];
    NSRegularExpression *uuidPattern = [NSRegularExpression regularExpressionWithPattern:
      @"\\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\z" options:0 error:NULL];
    for (int i = 0; i < 128; i++) {
      NSString *profileId = [ProfileDatabaseLifecycle generateProfileId];
      Check([uuidPattern numberOfMatchesInString:profileId options:0 range:NSMakeRange(0, profileId.length)] == 1, @"Native ID is lowercase v4 UUID");
      Check([[[[NSUUID alloc] initWithUUIDString:profileId] UUIDString].lowercaseString isEqual:profileId], @"UUID is canonical");
      Check(![ids containsObject:profileId], @"Duplicate UUID in test sample");
      [ids addObject:profileId];
      NSString *dbName = [@"formulus_" stringByAppendingString:profileId];
      Check([[lifecycle isDatabaseOpen:dbName error:NULL] isEqual:@NO], @"Generation does not mark opened");
      Check([[lifecycle databaseExists:dbName error:NULL] isEqual:@NO], @"Generation does not create files");
    }
    for (NSString *probeName in @[@"formulus", Name()]) {
      Check([[lifecycle databaseExists:probeName error:NULL] isEqual:@NO], @"Missing database absent");
      Write(Path(root, probeName, @".db.backup"));
      Write(Path(root, probeName, @".db-wal-extra"));
      Check([[lifecycle databaseExists:probeName error:NULL] isEqual:@NO], @"Only exact suffixes count");
      for (NSString *suffix in Suffixes()) {
        NSString *path = Path(root, probeName, suffix);
        Write(path);
        Check([[lifecycle databaseExists:probeName error:NULL] isEqual:@YES], [@"Each suffix alone counts: " stringByAppendingString:suffix]);
        Check([[lifecycle isDatabaseOpen:probeName error:NULL] isEqual:@NO], @"Existence does not mark opened");
        Check([[NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:NULL] isEqual:@"preserve me"], @"Existence leaves files intact");
        Check([files removeItemAtPath:path error:NULL], @"Remove suffix fixture");
        Check([[lifecycle databaseExists:probeName error:NULL] isEqual:@NO], @"Removed suffix absent");
      }
      [files removeItemAtPath:Path(root, probeName, @".db.backup") error:NULL];
      [files removeItemAtPath:Path(root, probeName, @".db-wal-extra") error:NULL];
    }
    // Probing multiple names must not consume the process's one preparation.
    ProfileDatabaseLifecycle *probeOnly = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
    [probeOnly databaseExists:@"formulus" error:NULL];
    [probeOnly databaseExists:Name() error:NULL];

    NSString *closed = Name();
    NSString *neighbor = Name();
    CreateFiles(root, closed);
    CreateFiles(root, neighbor);
    Check([[lifecycle databaseExists:closed error:NULL] isEqual:@YES], @"Closed file set exists");
    Check([[lifecycle deleteDatabase:closed error:NULL] isEqual:@YES], @"Delete closed files after existence check");
    Check([[lifecycle databaseExists:closed error:NULL] isEqual:@NO], @"Deleted files absent after existence check");
    Check([[lifecycle deleteDatabase:closed error:NULL] isEqual:@YES], @"Idempotent deletion");
    for (NSString *suffix in Suffixes()) {
      Check(![files fileExistsAtPath:Path(root, closed, suffix)], @"Target remains");
      Check([[NSString stringWithContentsOfFile:Path(root, neighbor, suffix) encoding:NSUTF8StringEncoding error:NULL]
             isEqualToString:@"preserve me"], @"Neighbor modified");
    }
    Check(![lifecycle prepareDatabase:closed error:NULL], @"Deleted name cannot reopen");
    NSString *orphan = Name();
    Write(Path(root, orphan, @".db-wal"));
    Check([[lifecycle deleteDatabase:orphan error:NULL] isEqual:@YES], @"Delete orphan WAL");
    Check(![files fileExistsAtPath:Path(root, orphan, @".db-wal")], @"Orphan WAL remains");

    Check([lifecycle prepareDatabase:@"formulus" error:NULL], @"Prepare Default");
    Check([lifecycle prepareDatabase:@"formulus" error:NULL], @"Idempotent prepare");
    Check(![files fileExistsAtPath:Path(root, @"formulus", @".db")], @"Prepare must not create/open SQLite");
    ExpectColdLaunch(probeOnly, @"formulus");
    ExpectColdLaunch(probeOnly, neighbor);
    Check([[lifecycle isDatabaseOpen:neighbor error:NULL] isEqual:@NO], @"Never-prepared target blocked but not marked");
    CreateFiles(root, @"formulus");
    Check([[lifecycle databaseExists:@"formulus" error:NULL] isEqual:@YES], @"Inspect opened name without SQLite");
    Check([[lifecycle deleteDatabase:@"formulus" error:NULL] isEqual:@NO], @"Opened Default defers");
    ProfileDatabaseLifecycle *reloaded = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
    Check([[reloaded isDatabaseOpen:@"formulus" error:NULL] isEqual:@YES], @"Guard survives module replacement");
    Check([[reloaded deleteDatabase:@"formulus" error:NULL] isEqual:@NO], @"Reload cannot enable deletion");
    ExpectColdLaunch(reloaded, @"formulus");
    for (NSString *suffix in Suffixes()) {
      Check([[NSString stringWithContentsOfFile:Path(root, @"formulus", suffix) encoding:NSUTF8StringEncoding error:NULL]
             isEqualToString:@"preserve me"], @"Opened files modified");
    }
    ExpectColdLaunch(lifecycle, neighbor);
    Check([[lifecycle isDatabaseOpen:neighbor error:NULL] isEqual:@NO], @"Rejected switch must not mark another DB");
    ExpectColdLaunch(reloaded, neighbor);
    ExpectColdLaunch(reloaded, @"formulus");
    Check([lifecycle prepareDatabase:@"formulus" error:NULL], @"Rejection cannot change original helper selection");
    // Models module replacement only; no actual Watermelon connections are created.
    ProfileDatabaseLifecycle *returned = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
    ExpectColdLaunch(returned, @"formulus");
    ExpectColdLaunch(returned, neighbor);
    Check([[returned deleteDatabase:@"formulus" error:NULL] isEqual:@NO], @"A -> B -> A retains A deletion guard");
    Check([[returned isDatabaseOpen:neighbor error:NULL] isEqual:@NO], @"Blocked warm A -> B must not mark B");
    for (NSString *suffix in Suffixes()) {
      Check([[NSString stringWithContentsOfFile:Path(root, @"formulus", suffix) encoding:NSUTF8StringEncoding error:NULL]
             isEqual:@"preserve me"], @"Rejected A revisit leaves files intact");
      Check([[NSString stringWithContentsOfFile:Path(root, neighbor, suffix) encoding:NSUTF8StringEncoding error:NULL]
             isEqual:@"preserve me"], @"Rejected B revisit leaves files intact");
    }
    NSString *firstVisit = Name();
    ExpectColdLaunch(returned, firstVisit);
    ExpectColdLaunch(returned, firstVisit);
    Check([[returned isDatabaseOpen:firstVisit error:NULL] isEqual:@NO], @"Rejected first visit does not mark name");
    Check([[returned deleteDatabase:neighbor error:NULL] isEqual:@YES], @"Unopened tombstone is still physically deletable");

    NSString *failed = Name();
    Write(Path(root, failed, @".db"));
    Check([files createDirectoryAtPath:Path(root, failed, @".db-wal") withIntermediateDirectories:NO attributes:nil error:NULL], @"Directory fixture");
    Check([[lifecycle databaseExists:failed error:NULL] isEqual:@YES], @"Non-regular entries remain evidence");
    NSError *error = nil;
    Check(![lifecycle deleteDatabase:failed error:&error] && error.code == ProfileDatabaseErrorIO, @"Reject directory as file");
    Check([files fileExistsAtPath:Path(root, failed, @".db")], @"Preflight prevents partial deletion");
    ProfileDatabaseLifecycle *another = [[ProfileDatabaseLifecycle alloc] initWithDirectory:root];
    Check(![another prepareDatabase:failed error:NULL], @"Failed deletion cannot reopen");
    [files removeItemAtPath:Path(root, failed, @".db-wal") error:NULL];
    Check([[lifecycle deleteDatabase:failed error:NULL] isEqual:@YES], @"Failure is retryable");

    NSString *linked = Name();
    NSString *target = [root stringByAppendingPathComponent:@"unrelated"];
    Write(target);
    Check([files createSymbolicLinkAtPath:Path(root, linked, @".db") withDestinationPath:target error:NULL], @"Symlink fixture");
    Check([[lifecycle databaseExists:linked error:NULL] isEqual:@YES], @"Symlinks remain legacy evidence");
    Check(![lifecycle deleteDatabase:linked error:NULL], @"Reject symlink");
    Check([[NSString stringWithContentsOfFile:target encoding:NSUTF8StringEncoding error:NULL] isEqualToString:@"preserve me"], @"Symlink target intact");
    [files removeItemAtPath:target error:NULL];
    Check([[lifecycle databaseExists:linked error:NULL] isEqual:@YES], @"Dangling symlink is not a fresh install");
    Check([[lifecycle isDatabaseOpen:linked error:NULL] isEqual:@NO], @"Malformed entries not marked opened");
    ProfileDatabaseLifecycle *missing = [[ProfileDatabaseLifecycle alloc] initWithDirectory:[root stringByAppendingPathComponent:@"missing"]];
    error = nil;
    Check(![missing databaseExists:Name() error:&error] && error.code == ProfileDatabaseErrorIO, @"Uninspectable directory cannot imply absence");
    Check(![missing deleteDatabase:Name() error:NULL], @"Uninspectable directory cannot report success");

    for (int i = 0; i < 32; i++) {
      RunFresh(argv[0], @[@"--race-delete"]);
      RunFresh(argv[0], @[i % 2 == 0 ? @"--race-same" : @"--race-different"]);
    }
    RunFresh(argv[0], @[@"--cold-check"]);
    for (NSString *coldTarget in @[@"formulus", firstVisit]) {
      RunFresh(argv[0], @[@"--cold-prepare", coldTarget]);
      ExpectColdLaunch([[ProfileDatabaseLifecycle alloc] initWithDirectory:root], coldTarget);
    }
    Check([files removeItemAtPath:root error:NULL], @"Clean up fixtures");
    NSLog(@"PASS: iOS all-switch cold-launch policy, bootstrap cleanup, and 64 fresh-process races");
  }
  return 0;
}
