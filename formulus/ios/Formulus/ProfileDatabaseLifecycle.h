#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, ProfileDatabaseError) {
  ProfileDatabaseErrorName = 1,
  ProfileDatabaseErrorState = 2,
  ProfileDatabaseErrorIO = 3,
};

/** Filesystem-only guard; every adapter must be prepared before construction. */
@interface ProfileDatabaseLifecycle : NSObject
- (instancetype)initWithDirectory:(NSString *)directory;
+ (NSString *)generateProfileId;
// Any exact main/journal/WAL/SHM entry is evidence; does not prepare or open SQLite.
- (nullable NSNumber *)databaseExists:(NSString *)name error:(NSError **)error;
- (BOOL)prepareDatabase:(NSString *)name error:(NSError **)error;
// nil = error, NO = deferred until process death, YES = all files absent.
- (nullable NSNumber *)deleteDatabase:(NSString *)name error:(NSError **)error;
// Conservative 'ever prepared', not a probe of SQLite's connection state.
- (nullable NSNumber *)isDatabaseOpen:(NSString *)name error:(NSError **)error;
@end

NS_ASSUME_NONNULL_END
