#import <React/RCTBridgeModule.h>
#import <React/RCTReloadCommand.h>
#import "ProfileDatabaseLifecycle.h"

@interface UserAppModule : NSObject <RCTBridgeModule>
@end

@implementation UserAppModule {
  ProfileDatabaseLifecycle *_profileDatabases;
  BOOL _restartRequested;
}

RCT_EXPORT_MODULE(UserAppModule);

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

- (dispatch_queue_t)methodQueue {
  static dispatch_queue_t queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    queue = dispatch_queue_create("org.opendataensemble.formulus.profileLifecycle", DISPATCH_QUEUE_SERIAL);
  });
  return queue;
}

- (instancetype)init {
  if ((self = [super init])) {
    // Both WatermelonDB 0.28 JSI and ObjC adapters resolve plain names here.
    NSString *documents = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
    if (documents) {
      _profileDatabases = [[ProfileDatabaseLifecycle alloc] initWithDirectory:documents];
    }
  }
  return self;
}

- (BOOL)checkAvailable:(RCTPromiseRejectBlock)reject {
  if (_restartRequested || !_profileDatabases) {
    reject(@"E_PROFILE_DATABASE_STATE", @"Profile runtime is restarting or its database directory is unavailable", nil);
    return NO;
  }
  return YES;
}

- (void)rejectDatabaseError:(NSError *)error reject:(RCTPromiseRejectBlock)reject {
  NSString *code = @"E_PROFILE_DATABASE_IO";
  if (error.code == ProfileDatabaseErrorName) {
    code = @"E_PROFILE_DATABASE_NAME";
  } else if (error.code == ProfileDatabaseErrorState) {
    code = @"E_PROFILE_DATABASE_STATE";
  }
  reject(code, error.localizedDescription, error);
}

RCT_EXPORT_METHOD(prepareDatabase:(NSString *)dbName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (![self checkAvailable:reject]) {
    return;
  }
  NSError *error = nil;
  if ([_profileDatabases prepareDatabase:dbName error:&error]) {
    resolve(nil);
  } else {
    [self rejectDatabaseError:error reject:reject];
  }
}

RCT_EXPORT_METHOD(deleteDatabase:(NSString *)dbName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (![self checkAvailable:reject]) {
    return;
  }
  NSError *error = nil;
  NSNumber *deleted = [_profileDatabases deleteDatabase:dbName error:&error];
  if (deleted) {
    resolve(deleted);
  } else {
    [self rejectDatabaseError:error reject:reject];
  }
}

RCT_EXPORT_METHOD(isDatabaseOpen:(NSString *)dbName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (![self checkAvailable:reject]) {
    return;
  }
  NSError *error = nil;
  NSNumber *opened = [_profileDatabases isDatabaseOpen:dbName error:&error];
  if (opened) {
    resolve(opened);
  } else {
    [self rejectDatabaseError:error reject:reject];
  }
}

RCT_EXPORT_METHOD(databaseExists:(NSString *)dbName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (![self checkAvailable:reject]) {
    return;
  }
  NSError *error = nil;
  NSNumber *exists = [_profileDatabases databaseExists:dbName error:&error];
  if (exists) {
    resolve(exists);
  } else {
    [self rejectDatabaseError:error reject:reject];
  }
}

RCT_EXPORT_METHOD(generateProfileId:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (![self checkAvailable:reject]) {
    return;
  }
  resolve([ProfileDatabaseLifecycle generateProfileId]);
}

RCT_EXPORT_METHOD(restartRuntime:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  if (_restartRequested) {
    reject(@"E_PROFILE_RESTART", @"Profile runtime restart is already in progress", nil);
    return;
  }
  _restartRequested = YES;
  dispatch_async(dispatch_get_main_queue(), ^{
    // Acknowledge scheduling only; JS may be disposed before it receives this.
    resolve(nil);
    // Retained for pre-preparation bootstrap retry, never for profile switching.
    // RN 0.83 supports this in release; the process-wide preparation guard survives.
    RCTTriggerReloadCommandListeners(@"Formulus bootstrap retry");
  });
}
@end
