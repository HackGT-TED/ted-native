# Running TedTime on your computer

This guide gets the TedTime app (`ted-native`) running on a new computer and on your phone. It works the same on macOS, Windows, and Linux.

You don't need to set up a database or a backend. Everyone shares the team's Supabase project, and the sound-effects backend is already deployed.

## What you need

| | |
|---|---|
| **Node.js 20 or newer** | [nodejs.org](https://nodejs.org). We use Node 24. Check with `node -v`. |
| **Git** | To clone the repo. |
| **Expo Go** on your phone | App Store or Play Store. It must support **Expo SDK 57**; update it if the app says it's incompatible. |
| **Two values from a teammate** | The Supabase project URL and publishable key. See step 2. |

You don't need Xcode or Android Studio to run the app on your phone with Expo Go.

## 1. Get the code

```bash
git clone https://github.com/HackGT-TED/ted-native.git
cd ted-native
npm install
```

Use `npm`, not `yarn` or `pnpm`. The repo includes `package-lock.json`, so everyone gets the same package versions.

If `npm install` prints warnings about security advisories or install scripts, you can ignore them. **Don't run `npm audit fix --force`.** It upgrades packages to versions that break Expo.

## 2. Add your `.env` file

Copy the example file:

```bash
cp .env.example .env          # macOS / Linux
copy .env.example .env        # Windows (Command Prompt)
```

Then open `.env` and fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://zftpsvnyaftmwdaxtdip.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ask a teammate, or Supabase > Project Settings > API>
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_UPLOAD_URL=
```

- **`EXPO_PUBLIC_SUPABASE_*`** are required. Without them you can't sign in, and uploads show "Uploads aren't available yet". Use the **publishable** key, never the service-role key.
- **Leave `EXPO_PUBLIC_API_URL` empty.** The app then uses the deployed backend at `https://backend-1opa.onrender.com`. Only set it if you're running the Python backend yourself (see [Using a local backend](#using-a-local-backend)).
- **Leave `EXPO_PUBLIC_UPLOAD_URL` empty.** During development, uploads go through the Expo dev server.

`.env` is already in `.gitignore`. Don't commit it, and share the key privately, not in chat channels or screenshots.

## 3. Start the app

```bash
npx expo start --clear
```

`--clear` resets Expo's cache. Use it the first time, and after every `git pull` or `npm install`. After that, `npx expo start` is enough.

Then open the app:

- **On your phone:** scan the QR code in the terminal. On iPhone, use the Camera app. On Android, use Expo Go. **Your phone and computer must be on the same Wi-Fi.**
- **In a web browser:** press `w`. This is useful for quick UI checks, but recording works best on a phone.
- **iOS Simulator:** press `i`. This needs a Mac with Xcode.
- **Android emulator:** press `a`. This needs Android Studio.

### On campus or hackathon Wi-Fi

Many shared networks block phones from reaching your computer. If scanning the QR code times out, use a tunnel:

```bash
npx expo start --tunnel
```

The first time, Expo may ask to install `@expo/ngrok`. Say yes.

## 4. Sign in

The app opens on **Welcome to TedTime**. Tap **Sign in**, then **Create an account**, or sign in with an existing one. Everything else in the app requires an account.

## Updating to the latest code

When teammates push changes:

```bash
git pull
npm install                 # in case dependencies changed
npx expo start --clear
```

Then **fully close the app on your phone** (swipe it away) and reopen it, so it loads the new code.

**If you skip this, the old code keeps running against the new database.** That causes errors like story lists failing to load: in Supabase **Logs → API Gateway**, requests to `/rest/v1/all_stories` fail with status 400.

## Using a local backend

You only need this if you're changing the Python sound-effects backend (the `Backend` repo).

1. **Start it so your phone can reach it:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
2. **Find your computer's local network IP address:**
   - macOS: `ipconfig getifaddr en0`
   - Windows: run `ipconfig` and use the **IPv4 Address**
   - Linux: `hostname -I`
3. **Set it in `.env`:** `EXPO_PUBLIC_API_URL=http://<that-ip>:8000`.
4. **Restart Expo.** Changes to `.env` only apply after a restart.

To check that your phone can reach it, open `http://<that-ip>:8000/health` in the phone's browser. When you're done, empty `EXPO_PUBLIC_API_URL` again to go back to the deployed backend.

## Database changes

**Everyone uses the same Supabase project, and every migration in `supabase/migrations/` has already been applied to it.** You don't need to run any SQL to get started.

If you add a new migration:
1. Give it the next number, after the highest one in `supabase/migrations/`.
2. Run it once in the Supabase **SQL Editor**, then tell the team.

Don't use `supabase db push`. The migrations were applied by hand, so it would try to re-run older ones.

## Running the checks

```bash
npx expo lint               # lint
npx tsc --noEmit            # type check
node --test tests/*.test.cjs  # unit tests
```

On Windows PowerShell, `tests/*.test.cjs` isn't expanded automatically. Run `node --test tests/` instead, or use Git Bash.

## Troubleshooting

| Problem | Fix |
|---|---|
| **"Project is incompatible with this version of Expo Go"** | Update Expo Go from the app store. The app uses SDK 57. |
| **QR code scan times out** | Make sure the phone is on the same Wi-Fi, or use `npx expo start --tunnel`. |
| **"Uploads aren't available yet" or sign-in does nothing** | `.env` is missing the Supabase values, or Expo wasn't restarted after editing it. |
| **Changes to `.env` don't apply** | Stop Expo with Ctrl+C and run `npx expo start --clear`. |
| **The screen shows an old version of the app** | `git pull`, `npm install`, `npx expo start --clear`, then fully close and reopen the app on the phone. |
| **Publish takes a long time** | The backend on Render sleeps when idle, so the first request after a while can take an extra 30–60 seconds. The app wakes it when Create opens. |
| **"Could not reach the story server"** | If `EXPO_PUBLIC_API_URL` is set, check that the backend is running and that your phone can open `/health`. Otherwise, try again: Render may still be starting. |
| **Recording doesn't start** | Allow microphone access. On iPhone: Settings → Expo Go → Microphone. |
| **Red error screen after pulling** | Run `npm install`, then `npx expo start --clear`. A teammate probably added a package. |
