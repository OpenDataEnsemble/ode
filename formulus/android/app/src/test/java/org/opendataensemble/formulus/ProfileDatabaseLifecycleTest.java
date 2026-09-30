package org.opendataensemble.formulus;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

/** Standalone JVM contract tests, deliberately requiring neither Android nor JUnit. */
public final class ProfileDatabaseLifecycleTest {
    private static final String[] SUFFIXES = {".db", ".db-journal", ".db-wal", ".db-shm"};

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static String name() {
        return "formulus_" + ProfileDatabaseLifecycle.generateProfileId();
    }

    private static void createFiles(Path root, String name) throws Exception {
        for (String suffix : SUFFIXES) Files.writeString(root.resolve(name + suffix), "preserve me");
    }

    private static void runFresh(String... args) throws Exception {
        var command = new ArrayList<>(Arrays.asList(
            new File(System.getProperty("java.home"), "bin/java").getPath(),
            "-cp", System.getProperty("java.class.path"), ProfileDatabaseLifecycleTest.class.getName()));
        command.addAll(Arrays.asList(args));
        check(new ProcessBuilder(command).inheritIO().start().waitFor() == 0,
            "Fresh-process case failed: " + Arrays.toString(args));
    }

    private static void raceDeletion(Path root) throws Exception {
        String raced = name();
        createFiles(root, raced);
        ProfileDatabaseLifecycle opener = new ProfileDatabaseLifecycle(root.toFile());
        ProfileDatabaseLifecycle cleaner = new ProfileDatabaseLifecycle(root.toFile());
        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<Boolean> prepared = new AtomicReference<>(false);
        AtomicReference<Boolean> deleted = new AtomicReference<>();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread prepare = new Thread(() -> {
            try { start.await(); opener.prepareDatabase(raced); prepared.set(true); }
            catch (IllegalStateException expected) { }
            catch (Throwable error) { failure.set(error); }
        });
        Thread delete = new Thread(() -> {
            try { start.await(); deleted.set(cleaner.deleteDatabase(raced)); }
            catch (Throwable error) { failure.set(error); }
        });
        prepare.start(); delete.start(); start.countDown(); prepare.join(); delete.join();
        check(failure.get() == null, "Unexpected race error: " + failure.get());
        check(prepared.get() != deleted.get(), "Prepare and deletion must be mutually exclusive");
        check(Files.exists(root.resolve(raced + ".db")) == prepared.get(), "Opened file was deleted");
    }

    private static void racePreparation(Path root, boolean sameName) throws Exception {
        String firstName = name();
        String secondName = sameName ? firstName : name();
        ProfileDatabaseLifecycle first = new ProfileDatabaseLifecycle(root.toFile());
        ProfileDatabaseLifecycle second = new ProfileDatabaseLifecycle(root.toFile());
        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<Boolean> firstPrepared = new AtomicReference<>(false);
        AtomicReference<Boolean> secondPrepared = new AtomicReference<>(false);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread one = new Thread(() -> {
            try { start.await(); first.prepareDatabase(firstName); firstPrepared.set(true); }
            catch (Throwable error) { failure.set(error); }
        });
        Thread two = new Thread(() -> {
            try { start.await(); second.prepareDatabase(secondName); secondPrepared.set(true); }
            catch (Throwable error) { failure.set(error); }
        });
        one.start(); two.start(); start.countDown(); one.join(); two.join();
        check(failure.get() == null, "Unexpected preparation error: " + failure.get());
        check(firstPrepared.get() && secondPrepared.get(), "Both preparations must succeed");
        check(first.isDatabaseOpen(firstName) && second.isDatabaseOpen(secondName), "Both names must be marked");
        first.prepareDatabase(secondName);
        second.prepareDatabase(firstName);
        check(!first.deleteDatabase(firstName) && !second.deleteDatabase(secondName), "Both prepared names veto deletion");
    }

    public static void main(String[] args) throws Exception {
        Path root = Files.createTempDirectory("formulus-profile-lifecycle-");
        try {
            ProfileDatabaseLifecycle lifecycle = new ProfileDatabaseLifecycle(root.toFile());
            // Each race needs a real fresh process; there is intentionally no reset hook.
            if (args.length == 1 && args[0].startsWith("--race-")) {
                if (args[0].equals("--race-delete")) raceDeletion(root);
                else racePreparation(root, args[0].equals("--race-same"));
                return;
            }
            if (args.length == 1 && args[0].equals("--cold-check")) {
                check(!lifecycle.isDatabaseOpen("formulus"), "A fresh process must have no opened names");
                createFiles(root, "formulus");
                check(lifecycle.databaseExists("formulus"), "Cold-process existence must see Default");
                check(!lifecycle.isDatabaseOpen("formulus"), "Existence must not mark Default opened");
                check(lifecycle.deleteDatabase("formulus"), "Unopened migrated Default can be deleted");
                check(!lifecycle.databaseExists("formulus"), "Deleted database must not exist");
                try (var paths = Files.list(root)) {
                    check(paths.findAny().isEmpty(), "Default files must all be absent");
                }
                return;
            }

            if (args.length == 2 && args[0].equals("--cold-prepare")) {
                String previouslyPrepared = args[1];
                String tombstone = name();
                createFiles(root, tombstone);
                check(lifecycle.deleteDatabase(tombstone), "Cold bootstrap must clean tombstones before preparing");
                check(!lifecycle.databaseExists(tombstone), "All tombstone files must be absent");
                check(!lifecycle.isDatabaseOpen(previouslyPrepared), "Fresh process must allow selected name");
                createFiles(root, previouslyPrepared);
                lifecycle.prepareDatabase(previouslyPrepared);
                lifecycle.prepareDatabase(previouslyPrepared);
                check(!lifecycle.deleteDatabase(previouslyPrepared), "Freshly prepared name must defer deletion");
                for (String suffix : SUFFIXES) {
                    check(Files.readString(root.resolve(previouslyPrepared + suffix)).equals("preserve me"), "Cold preparation changed data");
                }
                ProfileDatabaseLifecycle reloaded = new ProfileDatabaseLifecycle(root.toFile());
                reloaded.prepareDatabase(previouslyPrepared);
                String other = name();
                reloaded.prepareDatabase(other);
                check(!lifecycle.deleteDatabase(other), "Distinct prepared name must defer deletion after reload");
                return;
            }

            for (String invalid : new String[] {"", "../formulus", "formulus.db", "formulus/other",
                    "formulus_", "FORMULUS", "formulus\n", "formulus\0", "file:formulus",
                    "formulus_01234567-89AB-CDEF-0123-456789ABCDEF"}) {
                try { lifecycle.prepareDatabase(invalid); throw new AssertionError("Invalid prepare accepted"); }
                catch (IllegalArgumentException expected) { }
                try { lifecycle.deleteDatabase(invalid); throw new AssertionError("Invalid delete accepted"); }
                catch (IllegalArgumentException expected) { }
                try { lifecycle.isDatabaseOpen(invalid); throw new AssertionError("Invalid query accepted"); }
                catch (IllegalArgumentException expected) { }
                try { lifecycle.databaseExists(invalid); throw new AssertionError("Invalid existence query accepted"); }
                catch (IllegalArgumentException expected) { }
            }

            Set<String> ids = new HashSet<>();
            for (int i = 0; i < 128; i++) {
                String id = ProfileDatabaseLifecycle.generateProfileId();
                check(id.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"), "Native ID must be a lowercase v4 UUID");
                check(UUID.fromString(id).toString().equals(id), "UUID must be canonical");
                check(ids.add(id), "Duplicate UUID in test sample");
                check(!lifecycle.isDatabaseOpen("formulus_" + id), "Generation must not mark opened");
                check(!lifecycle.databaseExists("formulus_" + id), "Generation must not create files");
            }
            for (String probeName : new String[] {"formulus", name()}) {
                check(!lifecycle.databaseExists(probeName), "Missing database must not exist");
                Files.writeString(root.resolve(probeName + ".db.backup"), "not a database");
                Files.writeString(root.resolve(probeName + ".db-wal-extra"), "not a sidecar");
                check(!lifecycle.databaseExists(probeName), "Only exact suffixes count");
                for (String suffix : SUFFIXES) {
                    Path file = root.resolve(probeName + suffix);
                    Files.writeString(file, "preserve me");
                    check(lifecycle.databaseExists(probeName), "Each suffix alone must count: " + suffix);
                    check(!lifecycle.isDatabaseOpen(probeName), "Existence must not mark opened");
                    check(Files.readString(file).equals("preserve me"), "Existence must not modify files");
                    Files.delete(file);
                    check(!lifecycle.databaseExists(probeName), "Removed suffix must be absent");
                }
                Files.delete(root.resolve(probeName + ".db.backup"));
                Files.delete(root.resolve(probeName + ".db-wal-extra"));
            }
            // Probing names must not mark them as prepared.
            ProfileDatabaseLifecycle probeOnly = new ProfileDatabaseLifecycle(root.toFile());
            probeOnly.databaseExists("formulus");
            probeOnly.databaseExists(name());

            String closed = name();
            String neighbor = name();
            createFiles(root, closed);
            createFiles(root, neighbor);
            check(lifecycle.databaseExists(closed), "Closed file set must exist");
            check(lifecycle.deleteDatabase(closed), "Closed files must be deletable after existence check");
            check(!lifecycle.databaseExists(closed), "Deleted files must be absent after existence check");
            check(lifecycle.deleteDatabase(closed), "Deletion must be idempotent");
            for (String suffix : SUFFIXES) {
                check(!Files.exists(root.resolve(closed + suffix)), "Target remains");
                check(Files.readString(root.resolve(neighbor + suffix)).equals("preserve me"), "Neighbor modified");
            }
            try { lifecycle.prepareDatabase(closed); throw new AssertionError("Deleted name reopened"); }
            catch (IllegalStateException expected) { }
            String orphan = name();
            Files.writeString(root.resolve(orphan + ".db-wal"), "orphan");
            check(lifecycle.deleteDatabase(orphan), "Orphan WAL must be removed even without main file");
            check(!Files.exists(root.resolve(orphan + ".db-wal")), "Orphan WAL remains");

            lifecycle.prepareDatabase("formulus");
            lifecycle.prepareDatabase("formulus");
            check(!Files.exists(root.resolve("formulus.db")), "Preparing must not create/open SQLite");
            probeOnly.prepareDatabase("formulus");
            check(!lifecycle.isDatabaseOpen(neighbor), "Never-prepared target remains unmarked");
            createFiles(root, "formulus");
            check(lifecycle.databaseExists("formulus"), "Existence can inspect an opened name without SQLite");
            check(!lifecycle.deleteDatabase("formulus"), "Opened Default must defer");
            ProfileDatabaseLifecycle reloaded = new ProfileDatabaseLifecycle(root.toFile());
            check(reloaded.isDatabaseOpen("formulus"), "Opened guard must survive module replacement");
            check(!reloaded.deleteDatabase("formulus"), "Reload must not enable physical deletion");
            reloaded.prepareDatabase("formulus");
            check(!reloaded.isDatabaseOpen(neighbor), "Unprepared name remains unmarked");
            reloaded.prepareDatabase(neighbor);
            check(lifecycle.isDatabaseOpen(neighbor), "Distinct name must be visible to other helpers");
            check(!lifecycle.deleteDatabase(neighbor), "Distinct prepared name vetoes deletion");
            lifecycle.prepareDatabase(neighbor);
            // Models module replacement only; no actual Watermelon connections are created.
            ProfileDatabaseLifecycle returned = new ProfileDatabaseLifecycle(root.toFile());
            returned.prepareDatabase("formulus");
            returned.prepareDatabase(neighbor);
            check(!returned.deleteDatabase("formulus") && !returned.deleteDatabase(neighbor), "A -> B -> A retains both deletion guards");
            for (String suffix : SUFFIXES) {
                check(Files.readString(root.resolve("formulus" + suffix)).equals("preserve me"), "Prepared A changed data");
                check(Files.readString(root.resolve(neighbor + suffix)).equals("preserve me"), "Prepared B changed data");
            }
            String firstVisit = name();
            check(!returned.isDatabaseOpen(firstVisit), "Unprepared name remains unmarked");
            returned.prepareDatabase(firstVisit);
            returned.prepareDatabase(firstVisit);
            check(returned.isDatabaseOpen(firstVisit), "First visit must mark name");
            check(!lifecycle.deleteDatabase(firstVisit), "First visit vetoes deletion");
            String unprepared = name();
            createFiles(root, unprepared);
            check(returned.deleteDatabase(unprepared), "Unprepared tombstone is physically deletable after other preparations");

            String failed = name();
            Files.writeString(root.resolve(failed + ".db"), "preserve me");
            Files.createDirectory(root.resolve(failed + ".db-wal"));
            check(lifecycle.databaseExists(failed), "Non-regular entries remain legacy evidence");
            try { lifecycle.deleteDatabase(failed); throw new AssertionError("Directory accepted as DB file"); }
            catch (java.io.IOException expected) { }
            check(Files.exists(root.resolve(failed + ".db")), "Preflight should prevent partial deletion");
            try { new ProfileDatabaseLifecycle(root.toFile()).prepareDatabase(failed); throw new AssertionError("Failed deletion reopened"); }
            catch (IllegalStateException expected) { }
            Files.delete(root.resolve(failed + ".db-wal"));
            check(lifecycle.deleteDatabase(failed), "Failed deletion must be retryable");

            String linked = name();
            Path target = root.resolve("unrelated");
            Files.writeString(target, "preserve me");
            Files.createSymbolicLink(root.resolve(linked + ".db"), target);
            check(lifecycle.databaseExists(linked), "Symlinks remain legacy evidence");
            try { lifecycle.deleteDatabase(linked); throw new AssertionError("Symlink accepted"); }
            catch (java.io.IOException expected) { }
            check(Files.readString(target).equals("preserve me"), "Symlink target changed");
            Files.delete(target);
            check(lifecycle.databaseExists(linked), "Dangling symlink must not imply fresh install");
            check(!lifecycle.isDatabaseOpen(linked), "Existence must not mark malformed files opened");
            try { new ProfileDatabaseLifecycle(root.resolve("missing").toFile()).databaseExists(name());
                throw new AssertionError("Uninspectable directory reported absence"); }
            catch (java.io.IOException expected) { }
            try { new ProfileDatabaseLifecycle(root.resolve("missing").toFile()).deleteDatabase(name());
                throw new AssertionError("Uninspectable directory reported success"); }
            catch (java.io.IOException expected) { }

            for (int i = 0; i < 32; i++) {
                runFresh("--race-delete");
                runFresh(i % 2 == 0 ? "--race-same" : "--race-different");
            }
            runFresh("--cold-check");
            for (String coldTarget : new String[] {"formulus", name()}) {
                if (!coldTarget.equals("formulus")) {
                    check(!lifecycle.isDatabaseOpen(coldTarget), "Cold target not prepared in parent");
                }
                runFresh("--cold-prepare", coldTarget);
                ProfileDatabaseLifecycle afterColdCheck = new ProfileDatabaseLifecycle(root.toFile());
                afterColdCheck.prepareDatabase(coldTarget);
                check(afterColdCheck.isDatabaseOpen(coldTarget), "Cold child must not mark parent process");
            }
            System.out.println("PASS: Android retained prepared-name guard, bootstrap cleanup, and 64 fresh-process races");
        } finally {
            try (var paths = Files.walk(root)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.delete(path);
            }
        }
    }
}
