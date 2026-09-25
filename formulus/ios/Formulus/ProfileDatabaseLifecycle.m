#import "ProfileDatabaseLifecycle.h"
#import <errno.h>
#import <sys/stat.h>
#import <unistd.h>

// Never reset on native module invalidation or RN reload. Only process death clears these.
static NSMutableSet<NSString *> *openedDatabases;
static NSMutableSet<NSString *> *retiredDatabases;
static NSRegularExpression *databaseNamePattern;

static BOOL Fail(NSError **error, ProfileDatabaseError code, NSString *message) {
  if (error) {
    *error = [NSError errorWithDomain:@"FormulusProfileDatabase" code:code
                            userInfo:@{NSLocalizedDescriptionKey: message}];
  }
  return NO;
}

static BOOL ValidateName(NSString *name, NSError **error) {
  if (![name isKindOfClass:NSString.class] ||
      ![databaseNamePattern firstMatchInString:name options:0 range:NSMakeRange(0, name.length)]) {
    return Fail(error, ProfileDatabaseErrorName, @"Expected formulus or formulus_<lowercase UUID>");
  }
  return YES;
}

@implementation ProfileDatabaseLifecycle {
  NSString *_directory;
}

+ (void)initialize {
  if (self == ProfileDatabaseLifecycle.class) {
    openedDatabases = [NSMutableSet new];
    retiredDatabases = [NSMutableSet new];
    databaseNamePattern = [NSRegularExpression regularExpressionWithPattern:
      @"\\Aformulus(?:_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\\z"
      options:0 error:NULL];
  }
}

+ (NSString *)generateProfileId {
  return NSUUID.UUID.UUIDString.lowercaseString;
}

- (instancetype)initWithDirectory:(NSString *)directory {
  if ((self = [super init])) {
    _directory = [directory copy];
  }
  return self;
}

- (BOOL)prepareDatabase:(NSString *)name error:(NSError **)error {
  @synchronized (ProfileDatabaseLifecycle.class) {
    if (!ValidateName(name, error)) {
      return NO;
    }
    if ([retiredDatabases containsObject:name]) {
      return Fail(error, ProfileDatabaseErrorState, @"A database scheduled for deletion cannot be reopened");
    }
    // Retain every prepared name across module and runtime replacement.
    [openedDatabases addObject:name];
    return YES;
  }
}

- (NSNumber *)isDatabaseOpen:(NSString *)name error:(NSError **)error {
  @synchronized (ProfileDatabaseLifecycle.class) {
    if (!ValidateName(name, error)) {
      return nil;
    }
    return @([openedDatabases containsObject:name]);
  }
}

- (NSNumber *)databaseExists:(NSString *)name error:(NSError **)error {
  @synchronized (ProfileDatabaseLifecycle.class) {
    if (!ValidateName(name, error)) {
      return nil;
    }
    // Listing names never opens a database descriptor. Include dangling symlinks
    // and non-regular entries as evidence, rather than silently treating them as absent.
    NSArray<NSString *> *entries = [NSFileManager.defaultManager
      contentsOfDirectoryAtPath:_directory error:NULL];
    if (!entries) {
      Fail(error, ProfileDatabaseErrorIO, @"Could not inspect the WatermelonDB directory");
      return nil;
    }
    for (NSString *suffix in @[@".db", @".db-journal", @".db-wal", @".db-shm"]) {
      if ([entries containsObject:[name stringByAppendingString:suffix]]) {
        return @YES;
      }
    }
    return @NO;
  }
}

- (NSNumber *)deleteDatabase:(NSString *)name error:(NSError **)error {
  @synchronized (ProfileDatabaseLifecycle.class) {
    if (!ValidateName(name, error)) {
      return nil;
    }
    if ([openedDatabases containsObject:name]) {
      return @NO;
    }
    // Block reopening after a partial deletion. The registry must retain its durable
    // tombstone across cold launches, and must never reuse deleted names.
    [retiredDatabases addObject:name];
    NSString *root = [_directory stringByResolvingSymlinksInPath];
    struct stat info;
    if (stat(root.fileSystemRepresentation, &info) != 0 || !S_ISDIR(info.st_mode)) {
      Fail(error, ProfileDatabaseErrorIO, @"Could not inspect the WatermelonDB directory");
      return nil;
    }
    NSMutableArray<NSString *> *paths = [NSMutableArray new];
    for (NSString *suffix in @[@".db", @".db-journal", @".db-wal", @".db-shm"]) {
      NSString *path = [root stringByAppendingPathComponent:[name stringByAppendingString:suffix]];
      [paths addObject:path];
      if (lstat(path.fileSystemRepresentation, &info) == 0) {
        if (!S_ISREG(info.st_mode)) {
          Fail(error, ProfileDatabaseErrorIO,
               [@"Refusing to delete a non-regular database file: " stringByAppendingString:path.lastPathComponent]);
          return nil;
        }
      } else if (errno != ENOENT) {
        Fail(error, ProfileDatabaseErrorIO,
             [@"Could not inspect database file: " stringByAppendingString:path.lastPathComponent]);
        return nil;
      }
    }
    // No SQLite engine is opened, no file contents read, no recursive directory removal.
    // Main file first; failures retain the tombstone for an idempotent retry.
    for (NSString *path in paths) {
      if (unlink(path.fileSystemRepresentation) != 0 && errno != ENOENT) {
        Fail(error, ProfileDatabaseErrorIO,
             [@"Could not delete database file: " stringByAppendingString:path.lastPathComponent]);
        return nil;
      }
    }
    for (NSString *path in paths) {
      if (lstat(path.fileSystemRepresentation, &info) == 0 || errno != ENOENT) {
        Fail(error, ProfileDatabaseErrorIO,
             [@"Database file is not confirmed absent: " stringByAppendingString:path.lastPathComponent]);
        return nil;
      }
    }
    return @YES;
  }
}
@end
