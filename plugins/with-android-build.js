/**
 * What a generated Android project needs on top of what prebuild writes, so
 * that `expo run:android` gets through on Windows.
 *
 * None of this can be fixed by hand and kept: `android/` is gitignored and
 * every prebuild writes it again from scratch, so a hand-edit survives until
 * the next one and then the same three failures come back in the same order.
 * A config plugin runs after the files are generated, which is the only place
 * a change to them lasts.
 */
const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withGradleProperties,
  withSettingsGradle,
} = require('@expo/config-plugins');

/**
 * Gradle's own default of 2g heap and 512m metaspace runs out part-way through
 * the New Architecture codegen, and the daemon dies with a bare `Metaspace`.
 */
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=2048m';

/**
 * The first CMake whose bundled ninja dropped its own hardcoded 260-character
 * check in `Stat()`. That check is ninja's, not Windows': turning on
 * `LongPathsEnabled` leaves it in place, and the codegen object paths — which
 * carry the full source path a second time, mirrored under the `.dir` — run to
 * around 355 characters, so an older ninja stops before the compiler is asked.
 */
const CMAKE_MIN = [3, 31, 0];

/** A dotted version as numbers, so `3.31.6` sorts above `3.9.0`. */
const parts = (name) => name.split('.').map((n) => Number.parseInt(n, 10) || 0);

const atLeast = (a, b) => {
  for (let i = 0; i < b.length; i += 1) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
};

/** Where the SDK is, by the names the Android tools themselves read. */
function sdkDir() {
  return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || null;
}

/** The newest installed CMake new enough to build these paths, if any. */
function cmakeDir(sdk) {
  const root = path.join(sdk, 'cmake');
  let names;
  try {
    names = fs.readdirSync(root);
  } catch {
    return null;
  }
  const usable = names
    .filter((name) => atLeast(parts(name), CMAKE_MIN))
    .sort((a, b) => (atLeast(parts(a), parts(b)) ? -1 : 1));
  return usable.length ? path.join(root, usable[0]) : null;
}

/**
 * Gradle 9 refuses a project name that starts or ends with a dot, and the name
 * here is the app's own — "Jot." — so prebuild writes one it will not accept.
 * Only the Gradle project is renamed: the name under the launcher icon is
 * `app_name` in strings.xml, which keeps its full stop.
 */
const withProjectName = (config) =>
  withSettingsGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^rootProject\.name\s*=\s*(['"])(.*)\1$/m,
      (line, quote, name) => {
        const trimmed = name.replace(/^\.+/, '').replace(/\.+$/, '');
        return trimmed && trimmed !== name
          ? `rootProject.name = ${quote}${trimmed}${quote}`
          : line;
      },
    );
    return cfg;
  });

const withJvmArgs = (config) =>
  withGradleProperties(config, (cfg) => {
    const found = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs',
    );
    if (found) found.value = JVM_ARGS;
    else cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    return cfg;
  });

/**
 * `cmake.dir` is how AGP is pointed at a CMake other than the one it pins, and
 * local.properties is the right place for it: it names absolute paths on this
 * machine, so it is per-machine and never committed. The path is written with
 * forward slashes because a .properties file reads a backslash as an escape,
 * and `C:\Users` would be loaded back as `C:Users`.
 *
 * Windows only. Elsewhere the long-path problem does not exist, and forcing a
 * particular CMake would only take away one AGP had already chosen.
 */
const withCmakeDir = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      if (process.platform !== 'win32') return cfg;
      const sdk = sdkDir();
      const cmake = sdk && cmakeDir(sdk);
      if (!cmake) return cfg;

      const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      const slashed = (p) => p.replace(/\\/g, '/');
      const kept = (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !/^\s*(sdk|cmake)\.dir\s*=/.test(line));

      const lines = [`sdk.dir=${slashed(sdk)}`, `cmake.dir=${slashed(cmake)}`, ...kept];
      fs.writeFileSync(file, `${lines.join('\n')}\n`);
      return cfg;
    },
  ]);

module.exports = (config) => withCmakeDir(withJvmArgs(withProjectName(config)));
