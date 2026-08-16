package org.opendataensemble.formulus

import android.app.Application
import android.webkit.WebView
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage
import org.opendataensemble.formulus.UserAppPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages.apply {
        // Packages that cannot be autolinked yet can be added manually here
        add(UserAppPackage())
        // JSI is a separate Gradle project from Watermelon's autolinked Java
        // adapter. Without this, jsi: true silently falls back to system SQLite.
        add(WatermelonDBJSIPackage())
      },
    )
  }

  override fun onCreate() {
    super.onCreate()
    DiagnosticsStore.recordHistoricalExits(this)
    WebView.setWebContentsDebuggingEnabled(true)
    loadReactNative(this)
  }
}