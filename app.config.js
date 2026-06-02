export default {
  "expo": {
    "name": "LogiPay",
    "slug": "LogiPay",
    "version": "1.1.1",
    "orientation": "portrait",
    "icon": "./assets/images/ios-app-icon.png",
    "scheme": "logipay",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.logipay.app",
      "usesAppleSignIn": true,
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "backgroundColor": "#72B5F5",
        "foregroundImage": "./assets/images/android-app-icon.png",
        "backgroundImage": "./assets/images/android-app-icon.png",
        "monochromeImage": "./assets/images/android-app-icon.png"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.logipay.app"
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/ios-app-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#72B5F5",
          "dark": {
            "backgroundColor": "#72B5F5"
          }
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.131808356586-3dim5m5b3ooa2taee0iqnoestl26biha"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "59d9a8b9-03da-4313-b6b6-04a1ea8a5faf"
      }
    },
    "owner": "moreno.dev",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/59d9a8b9-03da-4313-b6b6-04a1ea8a5faf"
    }
  }
}