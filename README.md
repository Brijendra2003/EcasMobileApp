# ECAS — mobile app

React Native app for professors, students and parents of St. John College of Engineering and Management. Admin roles
use the web portal (`../college-attendance-system`). Design: [MobileApp_Architecture.md](MobileApp_Architecture.md).

Everyone signs in with **email and password**, including parents. Professors and students get a password-setup email,
and parents get a password from the college office (web: People → Guardians → Create login). There is no SMS or OTP
sign-in.

Stack: React Native 0.88 (New Architecture, Hermes), TypeScript, React Navigation 7, TanStack Query (persisted to
encrypted MMKV), SQLCipher via op-sqlite for offline attendance, NativeWind, Supabase.

## Setup

```sh
npm install
cd ios && bundle install && bundle exec pod install && cd ..   # macOS only
npm start
npm run android            # dev flavour, in.edu.sjcem.attendance.dev
npm run ios                # Debug configuration
```

`npm run verify` runs the typecheck, lint and unit tests. `npm run test:backend` builds a local database from the web
project's migrations and runs the mobile API contract tests (`backend/tests`).

`src/shared` is generated from the web project. Change it there, then run `npm run sync:shared`.

## Environments

Each environment has its own `.env.*` file with **public values only** (Supabase URL and publishable key). The app
refuses to start if `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` is missing.

| Environment | File | Android | iOS |
|---|---|---|---|
| Development | `.env.development` | `dev` flavour, id `….dev` | Debug configuration, id `….dev` |
| Staging | `.env.staging` | `staging` flavour, id `….staging` | Release + `/tmp/envfile` (below) |
| Production | `.env.production` | `prod` flavour, `in.edu.sjcem.attendance` | Release configuration |

Production must point at the production Supabase project. Dev and staging must never point at it.

The app talks to the RPCs and views in `college-attendance-system/supabase/migrations/20261026000100_mobile_api.sql`.
That migration has to be applied to the target database before the app will work.

## Releasing

Bump the version on both platforms for every store upload:

- Android: `versionCode` (+1 every upload) and `versionName` in `android/app/build.gradle`.
- iOS: `CURRENT_PROJECT_VERSION` (build number) and `MARKETING_VERSION` in Xcode → target → General.

To force old versions to update, raise `app_config.min_mobile_version` on the server. Set `IOS_APP_STORE_ID` in
`.env.production` once the app exists in App Store Connect, so the update screen opens the app's own page.

### Android (Play Store)

1. Create the upload key once and keep it, and its passwords, somewhere safe outside the repo:
   ```sh
   keytool -genkeypair -v -storetype PKCS12 -keystore ecas-upload.jks -alias ecas-upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add to `~/.gradle/gradle.properties` (or CI secrets):
   ```properties
   ECAS_UPLOAD_STORE_FILE=/absolute/path/to/ecas-upload.jks
   ECAS_UPLOAD_STORE_PASSWORD=…
   ECAS_UPLOAD_KEY_ALIAS=ecas-upload
   ECAS_UPLOAD_KEY_PASSWORD=…
   ```
   A `prodRelease` build fails without these; dev and staging release builds fall back to the debug key.
3. `npm run build:android` → `android/app/build/outputs/bundle/prodRelease/app-prod-release.aab`.
4. Upload to Play Console with **Play App Signing** enabled. Test on the internal track first.

### iOS (App Store)

1. In Xcode, open `ios/EcasMobileApp.xcworkspace` → target → Signing & Capabilities. Pick the college's team.
   Bundle ids: `in.edu.sjcem.attendance` (Release) and `in.edu.sjcem.attendance.dev` (Debug).
2. `cd ios && bundle exec pod install` after changing the Podfile or native dependencies. The Podfile makes Release read
   `.env.production` and Debug read `.env.development`.
3. Product → Archive (Release, "Any iOS Device") → Distribute → App Store Connect → TestFlight.
4. Staging on iOS: `echo .env.staging > /tmp/envfile`, archive, then **delete `/tmp/envfile`**. It overrides every
   build while it exists.

## Not built yet

- **Push notifications.** Token registration and payload handling exist (`src/lib/push.ts`), but the FCM transport is
  not attached: it needs a Firebase project (`google-services.json` and `GoogleService-Info.plist` per environment),
  `@react-native-firebase/messaging` and the APNs key. The server side still needs the dispatcher that drains
  `notification_outbox`. Until then the in-app notification centre is the only channel.
- **Crash reporting.** No Sentry or Crashlytics yet.
- **R8 / ProGuard.** Off (`enableProguardInReleaseBuilds` in `android/app/build.gradle`). Turn it on only together
  with a full test pass of a release build.
