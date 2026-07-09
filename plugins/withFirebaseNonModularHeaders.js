const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo Config Plugin to fix the "non-modular header inside framework module"
 * build error caused by @react-native-firebase when using `useFrameworks: "static"`.
 *
 * Sets CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES
 * and adds -Wno-non-modular-include-in-framework-module to compiler flags.
 */
function withFirebaseNonModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfileContent = fs.readFileSync(podfilePath, "utf-8");

      // Check if fix is already applied
      if (podfileContent.includes("CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")) {
        return config;
      }

      const postInstallFix = `
    # Fix @react-native-firebase non-modular header errors with useFrameworks: "static"
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

      // Insert after the react_native_post_install closing paren
      podfileContent = podfileContent.replace(
        /(react_native_post_install\([\s\S]*?\n\s*\))/,
        `$1\n${postInstallFix}`
      );

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
}

module.exports = withFirebaseNonModularHeaders;
