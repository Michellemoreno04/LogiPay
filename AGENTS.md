# AGENTS.md — LogiPay Workspace Guide

Guía integral para agentes de IA que trabajan en el repositorio **LogiPay**. Contiene la arquitectura del sistema, convenciones técnicas, patrones de datos offline-first y flujos de trabajo recomendados.

---

## 1. Visión General del Proyecto

**LogiPay** es una aplicación móvil fintech / punto de venta (POS) y gestión de inventario, créditos y cobros para pequeños y medianos comerciantes. Permite operar 100% sin conexión a internet (offline-first) y sincronizar datos en la nube de forma transparente cuando hay conectividad.

- **Framework**: Expo SDK 54 (`~54.0.33`), React Native `0.81.5`, React `19.1.0`.
- **Arquitectura React Native**: Nueva Arquitectura habilitada (`newArchEnabled: true`) y React Compiler (`reactCompiler: true`).
- **Enrutamiento**: Expo Router v6 (`app/`, rutas tipadas `typedRoutes: true`).
- **Base de Datos Local**: SQLite nativo mediante `expo-sqlite: ~16.0.10` (fuente única de verdad en el cliente).
- **Backend / Nube**: Firebase Firestore (sincronización bidireccional mediante outbox) + Firebase Authentication (`@react-native-firebase/auth` y JS SDK).
- **Rendimiento**: `@shopify/flash-list: 2.0.2`, `react-native-reanimated: ~4.1.1`, `react-native-worklets: ^0.5.1`.
- **Hardware / Cámara**: `react-native-vision-camera: 4` (escaneo de códigos de barra y OCR), `expo-image-picker`, `expo-audio`, `expo-haptics`.

---

## 2. Mapa del Repositorio

```text
LogiPay/
├── app/                      # Rutas y pantallas de Expo Router
│   ├── _layout.jsx           # Layout raíz: proveedores de Auth, LocalData y Alert
│   ├── (tabs)/               # Navegación por pestañas principales
│   │   ├── index.jsx         # Inicio: Resumen, tarjetas de métricas, accesos rápidos
│   │   ├── products.jsx      # Catálogo e inventario de productos
│   │   ├── users.jsx         # Directorio de clientes y saldos
│   │   └── profile.jsx       # Perfil del comerciante y ajustes
│   ├── [id].jsx              # Ficha de detalle de un cliente (deudas, abonos, historial)
│   ├── quick-scan.jsx        # Punto de venta rápido con cámara y escáner
│   ├── add-product.jsx       # Alta y edición de productos / códigos de barra
│   ├── recurring-payments.jsx# Pagos recurrentes y suscripciones periódicas
│   ├── product/[productId].jsx # Ficha individual de producto y ventas asociadas
│   └── ...                   # Onboarding, login, register, business-type
├── components/               # Componentes UI reutilizables
│   ├── StatsCards.jsx        # Tarjetas de estadísticas financieras
│   ├── ActivityItem.jsx      # Renglón de actividad reciente (transacciones/ventas)
│   ├── ShareTransactionCard.jsx # Generador de recibos compartibles
│   └── modales/              # Diálogos modales (SaleModal, ProductModal, ClientDetailsModals)
├── context/                  # Estados globales reactivos
│   ├── LocalDataContext.jsx  # Proveedor reactivo de datos locales (SQLite + listener)
│   └── AlertContext.jsx      # Notificaciones y alertas en app
├── authContext/              # Autenticación y sesión de usuario
│   ├── authContext.jsx       # Contexto de autenticación y carga de usuario local
│   ├── googleAuth.jsx        # Integración nativa Google Sign-In
│   └── appleAuth.jsx         # Integración nativa Sign in with Apple
├── utils/                    # Lógica de negocio y persistencia
│   ├── database.js           # Esquema SQLite, tablas, migraciones y consultas locales
│   ├── syncEngine.js         # Motor outbox para sincronización con Firestore
│   ├── bootstrapSync.js      # Descarga inicial desde Firebase al primer login
│   ├── clientService.js      # Servicios CRUD para clientes y transacciones
│   ├── productService.js      # Servicios CRUD para inventario y ventas
│   └── responsive.js         # Utilidades de escalado y diseño responsivo
├── plugins/                  # Config plugins personalizados de Expo
│   └── withFirebaseNonModularHeaders.js # Parche de compatibilidad iOS CocoaPods
├── firebaseConfig/           # Inicialización de Firebase Web SDK
├── app.config.js             # Configuración dinámica de Expo y plugins nativos
└── eas.json                  # Perfiles de compilación remota EAS Build
```

---

## 3. Reglas de Oro y Convenciones de Arquitectura

### 3.1. Paradigma Offline-First (Obligatorio)
1. **SQLite es la fuente primaria de verdad**:
   - NUNCA consultes Firestore directamente para renderizar listas o pantallas en caliente.
   - Las lecturas de UI se hacen SIEMPRE desde SQLite (vía `LocalDataContext` o funciones de `utils/database.js`).
2. **Mutaciones locales primero, sincronización después**:
   - Toda creación, edición o borrado debe insertarse en SQLite de inmediato.
   - Luego, encolar la operación en la tabla `outbox` (`addToOutbox(...)`).
   - Disparar `syncOutbox()` en background sin bloquear la interfaz de usuario ni lanzar errores si no hay internet.
3. **Manejo de tokens en Outbox**:
   - Usar `'SERVER_TIMESTAMP'` para marcas de tiempo sincronizadas.
   - Usar `'INCREMENT_<valor>'` para operaciones atómicas de saldo en Firebase.

### 3.2. Estilos y Accesibilidad
- **Escala de fuentes**: La aplicación deshabilita `allowFontScaling` en el layout raíz (`Text.defaultProps.allowFontScaling = false`) para evitar desbordamientos visuales en dispositivos con tipografía gigante configurada en el SO. Mantener diseños limpios y probar usando `utils/responsive.js`.
- **Tema y colores**: Paleta moderna con gradientes suaves (`#4C669F`, `#3B5998`, `#192f6a`), bordes redondeados consistentes (12–16px), sombras sutiles y tarjetas tipo glassmorphism.

### 3.3. React 19 y Nueva Arquitectura
- El proyecto corre con `newArchEnabled: true` y `reactCompiler: true`.
- Usar hooks modernos de React (`useCallback`, `useMemo`) con listas de dependencias correctas para evitar ciclos de render y advertencias de ESLint.
- En animaciones con `react-native-reanimated` v4, asegurar que las llamadas compartidas corran en el hilo de UI o mediante worklets (`react-native-worklets`).

### 3.4. Compilación y Módulos Nativos (iOS & Android)
- En iOS, se utiliza `"useFrameworks": "static"` en `expo-build-properties` para compatibilidad con CocoaPods de Firebase.
- El plugin `./plugins/withFirebaseNonModularHeaders` es mandatorio en `app.config.js` para compilar cabeceras de Firebase sin errores en Xcode.
- No alterar los identificadores de paquete (`com.logipay.app`) ni las rutas de `google-services.json` y `GoogleService-Info.plist` sin motivo justificado.

---

## 4. Comandos de Desarrollo Frecuentes

```bash
# Iniciar servidor de desarrollo con caché limpia
npx expo start -c

# Ejecutar linter del proyecto
npm run lint

# Generar compilación previa para pruebas en dispositivo (EAS)
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Desplegar actualización OTA instantánea a producción
eas update --channel production --message "Descripción del cambio"
```

---

## 5. Habilidades Especializadas (.agents/skills)

Este repositorio cuenta con habilidades modulares en `.agents/skills/`:
- **`offline-sync`**: Guía paso a paso para añadir entidades, modificar esquemas SQLite, registrar migraciones y encolar mutaciones en el outbox de sincronización.
- **`eas-build-config`**: Procedimiento para configurar, depurar y resolver incidencias en compilaciones nativas de iOS/Android con Expo SDK 54, Firebase y EAS Build.
