package org.opendataensemble.formulus

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Writes Android [ApplicationExitInfo] records to filesDir/diagnostics/exits.ndjson
 * so JS can read the same path as RNFS.DocumentDirectoryPath/diagnostics/.
 *
 * Also captures crash stack traces under filesDir/diagnostics/traces/ so field
 * reports carry an actual stack, not just an exit reason:
 *  - a JVM [Thread.UncaughtExceptionHandler] writes the stack at crash time,
 *    which is the only way to get a trace for a REASON_CRASH (JVM exception);
 *  - [getTraceInputStream] is dumped for REASON_ANR / REASON_CRASH_NATIVE, the
 *    only reasons Android populates it for.
 * Each trace is truncated to [TRACE_MAX_BYTES] and only the most recent
 * [TRACE_KEEP] are retained so the diagnostics zip stays small.
 */
object DiagnosticsStore {
    const val DIR_NAME = "diagnostics"
    const val EXITS_FILE = "exits.ndjson"
    const val TRACES_DIR = "traces"
    private const val MAX_BYTES = 256 * 1024
    private const val DESCRIPTION_MAX = 500
    private const val TRACE_MAX_BYTES = 64 * 1024
    private const val TRACE_KEEP = 4

    /**
     * Chains a default uncaught-exception handler that persists the JVM stack
     * before delegating to the previous handler (which crashes the process).
     * Idempotent: install once from Application.onCreate.
     */
    fun installUncaughtHandler(context: Context) {
        try {
            val appContext = context.applicationContext
            val previous = Thread.getDefaultUncaughtExceptionHandler()
            Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
                try {
                    val stack = StringWriter()
                    PrintWriter(stack).use { throwable.printStackTrace(it) }
                    val header =
                        "thread: ${thread.name}\n" +
                            "time: ${System.currentTimeMillis()}\n\n"
                    writeTrace(appContext, "jvm-${System.currentTimeMillis()}.txt", header + stack)
                } catch (_: Throwable) {
                    // Never mask the original crash.
                } finally {
                    previous?.uncaughtException(thread, throwable)
                }
            }
        } catch (_: Throwable) {
            // Never block app start.
        }
    }

    fun recordHistoricalExits(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return
        }
        try {
            val am =
                context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
                    ?: return
            val exits = am.getHistoricalProcessExitReasons(context.packageName, 0, 5)
            if (exits.isNullOrEmpty()) {
                return
            }
            val file = exitsFile(context)
            val known = readTimestamps(file)
            val batch = StringBuilder()
            for (info in exits) {
                val ts = info.timestamp
                if (!known.add(ts)) {
                    continue
                }
                dumpAeiTrace(context, info)
                batch.append(toJson(info)).append('\n')
            }
            if (batch.isNotEmpty()) {
                appendRotated(file, batch.toString())
            }
            pruneTraces(context)
        } catch (_: Throwable) {
            // Never block app start.
        }
    }

    private fun dumpAeiTrace(context: Context, info: ApplicationExitInfo) {
        if (info.reason != ApplicationExitInfo.REASON_ANR &&
            info.reason != ApplicationExitInfo.REASON_CRASH_NATIVE
        ) {
            return
        }
        try {
            val stream = info.traceInputStream ?: return
            val bytes = stream.use { it.readBounded(TRACE_MAX_BYTES) }
            if (bytes.isNotEmpty()) {
                writeTrace(context, "aei-${info.timestamp}.txt", String(bytes))
            }
        } catch (_: Throwable) {
            // A missing trace must not abort exit recording.
        }
    }

    private fun writeTrace(context: Context, name: String, text: String) {
        val dir = File(File(context.filesDir, DIR_NAME), TRACES_DIR)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        val truncated =
            if (text.length > TRACE_MAX_BYTES) {
                text.substring(0, TRACE_MAX_BYTES) + "\n…[truncated]"
            } else {
                text
            }
        File(dir, name).writeText(truncated)
    }

    private fun pruneTraces(context: Context) {
        try {
            val dir = File(File(context.filesDir, DIR_NAME), TRACES_DIR)
            val files = dir.listFiles()?.filter { it.isFile } ?: return
            if (files.size <= TRACE_KEEP) {
                return
            }
            files.sortedByDescending { it.lastModified() }
                .drop(TRACE_KEEP)
                .forEach { it.delete() }
        } catch (_: Throwable) {
            // Best-effort cleanup.
        }
    }

    fun readRecentExitLines(context: Context, max: Int): List<String> {
        val file = exitsFile(context)
        if (!file.exists()) {
            return emptyList()
        }
        return try {
            file.readLines().filter { it.isNotBlank() }.takeLast(max.coerceAtLeast(0))
        } catch (_: Throwable) {
            emptyList()
        }
    }

    private fun exitsFile(context: Context): File {
        val dir = File(context.filesDir, DIR_NAME)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return File(dir, EXITS_FILE)
    }

    private fun readTimestamps(file: File): MutableSet<Long> {
        val out = mutableSetOf<Long>()
        if (!file.exists()) {
            return out
        }
        try {
            file.forEachLine { line ->
                if (line.isBlank()) return@forEachLine
                try {
                    val ts = JSONObject(line).optLong("timestamp", -1L)
                    if (ts >= 0L) {
                        out.add(ts)
                    }
                } catch (_: Throwable) {
                    // skip malformed
                }
            }
        } catch (_: Throwable) {
            // ignore
        }
        return out
    }

    private fun toJson(info: ApplicationExitInfo): String {
        val obj = JSONObject()
        obj.put("timestamp", info.timestamp)
        obj.put("reason", reasonName(info.reason))
        obj.put("status", info.status)
        obj.put("importance", info.importance)
        obj.put("pssKb", info.pss)
        obj.put("rssKb", info.rss)
        val description = info.description?.take(DESCRIPTION_MAX) ?: ""
        obj.put("description", description)
        return obj.toString()
    }

    private fun reasonName(reason: Int): String {
        return when (reason) {
            ApplicationExitInfo.REASON_EXIT_SELF -> "REASON_EXIT_SELF"
            ApplicationExitInfo.REASON_SIGNALED -> "REASON_SIGNALED"
            ApplicationExitInfo.REASON_LOW_MEMORY -> "REASON_LOW_MEMORY"
            ApplicationExitInfo.REASON_CRASH -> "REASON_CRASH"
            ApplicationExitInfo.REASON_CRASH_NATIVE -> "REASON_CRASH_NATIVE"
            ApplicationExitInfo.REASON_ANR -> "REASON_ANR"
            ApplicationExitInfo.REASON_INITIALIZATION_FAILURE ->
                "REASON_INITIALIZATION_FAILURE"
            ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "REASON_PERMISSION_CHANGE"
            ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE ->
                "REASON_EXCESSIVE_RESOURCE_USAGE"
            ApplicationExitInfo.REASON_USER_REQUESTED -> "REASON_USER_REQUESTED"
            ApplicationExitInfo.REASON_USER_STOPPED -> "REASON_USER_STOPPED"
            ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "REASON_DEPENDENCY_DIED"
            ApplicationExitInfo.REASON_OTHER -> "REASON_OTHER"
            else -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    reason == ApplicationExitInfo.REASON_FREEZER
                ) {
                    "REASON_FREEZER"
                } else {
                    "REASON_$reason"
                }
            }
        }
    }

    private fun InputStream.readBounded(limit: Int): ByteArray {
        val buffer = ByteArray(limit)
        var total = 0
        while (total < limit) {
            val read = this.read(buffer, total, limit - total)
            if (read < 0) {
                break
            }
            total += read
        }
        return buffer.copyOf(total)
    }

    private fun appendRotated(file: File, chunk: String) {
        val nextSize = (if (file.exists()) file.length() else 0L) + chunk.length
        if (nextSize > MAX_BYTES && file.exists()) {
            val backup = File(file.parentFile, "${file.name}.1")
            if (backup.exists()) {
                backup.delete()
            }
            file.renameTo(backup)
        }
        file.appendText(chunk)
    }
}
