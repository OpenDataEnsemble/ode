package org.opendataensemble.formulus

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

class DiagnosticsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DiagnosticsModule"
    }

    @ReactMethod
    fun getRecentExits(max: Int, promise: Promise) {
        try {
            val lines = DiagnosticsStore.readRecentExitLines(reactApplicationContext, max)
            val array = Arguments.createArray()
            for (line in lines) {
                try {
                    val obj = JSONObject(line)
                    val map = Arguments.createMap()
                    map.putDouble("timestamp", obj.optLong("timestamp").toDouble())
                    map.putString("reason", obj.optString("reason"))
                    map.putInt("status", obj.optInt("status"))
                    map.putInt("importance", obj.optInt("importance"))
                    map.putInt("pssKb", obj.optInt("pssKb"))
                    map.putInt("rssKb", obj.optInt("rssKb"))
                    map.putString("description", obj.optString("description"))
                    array.pushMap(map)
                } catch (_: Throwable) {
                    // skip malformed
                }
            }
            promise.resolve(array)
        } catch (e: Throwable) {
            promise.reject("diagnostics_exits", e)
        }
    }
}
