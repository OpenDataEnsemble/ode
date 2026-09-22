package org.opendataensemble.formulus;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/** Filesystem-only lifecycle guard. Every adapter must be prepared before it is constructed. */
final class ProfileDatabaseLifecycle {
    private static final Pattern DATABASE_NAME = Pattern.compile(
        "formulus(?:_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?"
    );
    private static final String[] SUFFIXES = {".db", ".db-journal", ".db-wal", ".db-shm"};
    // Never clear these during module invalidation or ReactHost reload. Only process death resets them.
    private static final Set<String> OPENED_DATABASES = new HashSet<>();
    private static final Set<String> RETIRED_DATABASES = new HashSet<>();

    static final class ColdLaunchRequiredException extends IllegalStateException {
        private static final long serialVersionUID = 1L;

        ColdLaunchRequiredException() {
            super("A profile database has already been prepared in this app process. Fully close and reopen Formulus before switching profiles or reinitializing the runtime; a JavaScript reload is not sufficient.");
        }
    }

    private final File directory;
    private String runningDatabase;

    ProfileDatabaseLifecycle(File directory) {
        this.directory = directory;
    }

    static String generateProfileId() {
        return UUID.randomUUID().toString();
    }

    private static void validateName(String name) {
        if (name == null || !DATABASE_NAME.matcher(name).matches()) {
            throw new IllegalArgumentException("Expected formulus or formulus_<lowercase UUID>");
        }
    }

    void prepareDatabase(String name) {
        synchronized (ProfileDatabaseLifecycle.class) {
            validateName(name);
            if (RETIRED_DATABASES.contains(name)) {
                throw new IllegalStateException("A database scheduled for deletion cannot be reopened");
            }
            // Watermelon's destroy hooks are process-global, not scoped to a DB/runtime.
            // After ANY preparation, only this helper's selected name may be repeated.
            if (!OPENED_DATABASES.isEmpty() && !name.equals(runningDatabase)) {
                throw new ColdLaunchRequiredException();
            }
            OPENED_DATABASES.add(name);
            runningDatabase = name;
        }
    }

    boolean isDatabaseOpen(String name) {
        synchronized (ProfileDatabaseLifecycle.class) {
            validateName(name);
            // Conservative 'ever prepared', not a probe of SQLite's actual connection state.
            return OPENED_DATABASES.contains(name);
        }
    }

    boolean databaseExists(String name) throws IOException {
        synchronized (ProfileDatabaseLifecycle.class) {
            validateName(name);
            // Inspect directory entries, never a database descriptor. Count even dangling
            // symlinks/non-regular entries as legacy evidence rather than a fresh install.
            Set<String> entries = listDirectory(directory.getCanonicalFile());
            for (String suffix : SUFFIXES) {
                if (entries.contains(name + suffix)) {
                    return true;
                }
            }
            return false;
        }
    }

    boolean deleteDatabase(String name) throws IOException {
        synchronized (ProfileDatabaseLifecycle.class) {
            validateName(name);
            if (OPENED_DATABASES.contains(name)) {
                return false;
            }
            // Prevent a prepare racing with a failed/partial deletion. The registry must also
            // retain its durable tombstone and never reuse a deleted name, including after death.
            RETIRED_DATABASES.add(name);
            File root = directory.getCanonicalFile();
            Set<String> entries = listDirectory(root);
            File[] files = new File[SUFFIXES.length];
            for (int i = 0; i < SUFFIXES.length; i++) {
                File file = new File(root, name + SUFFIXES[i]);
                files[i] = file;
                if (entries.contains(file.getName()) &&
                    (!file.getCanonicalFile().equals(file) || !file.isFile())) {
                    throw new IOException("Refusing to delete a non-regular database file: " + file.getName());
                }
            }
            // Remove the main file first. On any failure, leave the tombstone for an idempotent retry.
            for (File file : files) {
                if (entries.contains(file.getName()) && !file.delete()) {
                    throw new IOException("Could not delete database file: " + file.getName());
                }
            }
            Set<String> remaining = listDirectory(root);
            for (File file : files) {
                if (remaining.contains(file.getName())) {
                    throw new IOException("Database file still exists: " + file.getName());
                }
            }
            return true;
        }
    }

    private static Set<String> listDirectory(File root) throws IOException {
        // File.exists() alone cannot distinguish absence from an I/O/permission error.
        // File APIs (rather than java.nio.file) also support Formulus's Android API 24 minimum.
        String[] names = root.list();
        if (names == null) {
            throw new IOException("Could not inspect the WatermelonDB directory");
        }
        return new HashSet<>(Arrays.asList(names));
    }
}
