# Vendored native sources

## Notifee Android core

`notifee/` is a **git clone** of [invertase/notifee](https://github.com/invertase/notifee) pinned to the same commit as your installed `@notifee/react-native` (see `NOTIFEE_COMMIT` in `scripts/vendor-notifee-core.mjs`).

Generate or update it before Android builds:

```bash
pnpm run vendor:notifee
```

The folder is gitignored. CI and F-Droid should run that command (or an equivalent `git clone` + `git checkout`) before `./gradlew assembleRelease`.

When you **upgrade `@notifee/react-native`**, update the npm package, read the new `gitHead` from the [npm registry](https://www.npmjs.com/package/@notifee/react-native?activeTab=versions), paste it into `scripts/vendor-notifee-core.mjs`, then run `pnpm run vendor:notifee` again.
