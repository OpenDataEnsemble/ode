package com.formulus

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class UserAppModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "UserAppModule"
    }

    @ReactMethod
    fun getVersion(promise: Promise) {
        promise.resolve("1.0.0")
    }
}
