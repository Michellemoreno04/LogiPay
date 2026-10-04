---
name: eas-build-config
description: >-
  Use this skill when configuring, diagnosing, or executing EAS builds, native CocoaPods/Gradle
  build issues, Firebase native credentials, or OTA updates with expo-updates in LogiPay.
---

# EAS Build & Native Configuration Guide (LogiPay)

Esta habilidad proporciona el procedimiento para diagnosticar y ejecutar compilaciones remotas o locales en EAS (Expo Application Services), manejar credenciales nativas y desplegar actualizaciones OTA.

---

## 1. Requisitos Clave de Configuración (`app.config.js`)

LogiPay utiliza la **Nueva Arquitectura de React Native** y librerías nativas de Firebase. Requiere las siguientes directivas obligatorias en `app.config.js`:

1. **New Architecture & React Compiler**:
   ```javascript
   "newArchEnabled": true,
   "experiments": {
     "typedRoutes": true,
     "reactCompiler": true
   }
   ```
2. **iOS Frameworks Estáticos**:
   Para permitir que `@react-native-firebase` compile adecuadamente en CocoaPods:
   ```javascript
   [
     "expo-build-properties",
     {
       "ios": {
         "useFrameworks": "static"
       }
     }
   ]
   ```
3. **Plugin de Encabezados No Modulares**:
   El plugin `./plugins/withFirebaseNonModularHeaders` asegura que Xcode no falle con el error `include of non-modular header inside framework module`.

---

## 2. Verificación de Archivos de Credenciales

Antes de compilar, verifica que existan los archivos en la raíz del proyecto:
- **iOS**: `GoogleService-Info.plist` (definido en `ios.googleServicesFile`).
- **Android**: `google-services.json` (definido en `android.googleServicesFile`).
- **Scheme de Google**: Asegúrate de que `iosUrlScheme` en `@react-native-google-signin/google-signin` coincida con el `REVERSED_CLIENT_ID` del archivo `.plist`.

---

## 3. Comandos de Compilación (EAS CLI)

```bash
# 1. Compilación de desarrollo interna (con Dev Client)
eas build --platform android --profile development
eas build --platform ios --profile development

# 2. Compilación APK/IPA de vista previa para distribución interna
eas build --platform android --profile preview
eas build --platform ios --profile preview

# 3. Compilación de producción (Play Store / App Store)
eas build --platform all --profile production
```

---

## 4. Despliegue de Actualizaciones OTA (`expo-updates`)

LogiPay tiene configurado `runtimeVersion: { "policy": "appVersion" }` y el canal correspondiente en `app.config.js`.

Para publicar correcciones rápidas de JavaScript/TypeScript sin generar un nuevo binario:

```bash
# Publicar actualización al canal de producción
eas update --channel production --message "Corrección de bug en cálculo de inventario"

# Publicar al canal de preview
eas update --channel preview --message "Prueba de nuevas tarjetas estadísticas"
```

> **Importante**: Las actualizaciones OTA solo aplican a cambios en código JS/Assets. Si se agregan nuevos paquetes nativos o se modifica `app.config.js` (plugins, permisos nativos), se debe generar un nuevo `eas build`.
