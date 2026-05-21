# SOTI Remote Camera - Foreground Capture POC

This is a compliant Android CameraX proof-of-concept for managed devices.
It does **not** perform hidden/silent camera capture. A visible Activity opens, camera preview is shown, and then the app captures a photo.

## Build
Open this folder in Android Studio, let Gradle sync, then build a debug APK:

```bash
./gradlew assembleDebug
```

APK output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Trigger from SOTI MobiControl script
After installing and granting camera permission, trigger a visible capture flow with:

```bash
am start -a com.example.sotiremotecamera.CAPTURE --ez capture_now true
```

Alternative component launch:

```bash
am start -n com.example.sotiremotecamera/.MainActivity --ez capture_now true
```

Photos are saved to:

```text
Pictures/SOTI
```

## Notes
- First launch requires CAMERA runtime permission unless permission is pre-granted by MDM/OEM policy.
- For production, add authentication/command validation, upload endpoint, audit logging, visible disclosure, and retention controls.
- Android privacy restrictions still apply; do not use this for covert capture.
