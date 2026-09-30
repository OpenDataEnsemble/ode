package org.opendataensemble.formulus

import com.facebook.react.ReactApplication
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.File
import java.io.IOException

class UserAppModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    // WatermelonDB 0.28's Java and JSI adapters both strip /databases from this path.
    private val profileDatabases = ProfileDatabaseLifecycle(
        File(reactContext.getDatabasePath("formulus.db").path.replace("/databases", "")).parentFile!!
    )
    @Volatile private var restartRequested = false

    override fun getName(): String {
        return "UserAppModule"
    }

    private fun databaseOperation(promise: Promise, operation: () -> Any?) {
        try {
            if (restartRequested) {
                throw IllegalStateException("Profile runtime restart is already in progress")
            }
            promise.resolve(operation())
        } catch (error: IllegalArgumentException) {
            promise.reject("E_PROFILE_DATABASE_NAME", error.message, error)
        } catch (error: IllegalStateException) {
            promise.reject("E_PROFILE_DATABASE_STATE", error.message, error)
        } catch (error: IOException) {
            promise.reject("E_PROFILE_DATABASE_IO", error.message, error)
        } catch (error: SecurityException) {
            promise.reject("E_PROFILE_DATABASE_IO", error.message, error)
        }
    }

    @ReactMethod
    fun prepareDatabase(dbName: String, promise: Promise) = databaseOperation(promise) {
        profileDatabases.prepareDatabase(dbName)
        null
    }

    @ReactMethod
    fun deleteDatabase(dbName: String, promise: Promise) = databaseOperation(promise) {
        profileDatabases.deleteDatabase(dbName)
    }

    @ReactMethod
    fun isDatabaseOpen(dbName: String, promise: Promise) = databaseOperation(promise) {
        profileDatabases.isDatabaseOpen(dbName)
    }

    @ReactMethod
    fun databaseExists(dbName: String, promise: Promise) = databaseOperation(promise) {
        profileDatabases.databaseExists(dbName)
    }

    @ReactMethod
    fun generateProfileId(promise: Promise) = databaseOperation(promise) {
        ProfileDatabaseLifecycle.generateProfileId()
    }

    @ReactMethod
    fun restartRuntime(promise: Promise) {
        if (restartRequested) {
            promise.reject("E_PROFILE_RESTART", "Profile runtime restart is already in progress")
            return
        }
        restartRequested = true
        UiThreadUtil.runOnUiThread {
            try {
                val application = reactApplicationContext.applicationContext as? ReactApplication
                val host = application?.reactHost
                    ?: throw IllegalStateException("ReactHost is unavailable; close and relaunch Formulus")
                // Retained for bootstrap retry before any DB preparation, not profile switches.
                // Process-wide prepared-name guards survive this release-capable RN reload.
                host.reload("Formulus bootstrap retry")
                // Acknowledges scheduling only. The old JS runtime may die before observing this.
                promise.resolve(null)
            } catch (error: Exception) {
                restartRequested = false
                promise.reject("E_PROFILE_RESTART", "Could not restart Formulus; close and relaunch the app", error)
            }
        }
    }

    @ReactMethod
    fun getVersion(promise: Promise) {
        promise.resolve("1.0.0")
    }
}
