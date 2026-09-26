# Welcome to your Expo app 👋

## Styling

All screens and UI components use Tailwind utility classes through NativeWind 4. The palette and icon font are defined in `tailwind.config.js`. Metro uses `inlineRem: 16` so spacing utilities match the original numeric dimensions on native and web.

Use `className` for component styling and `contentContainerClassName` for scroll content. Shared typography and buttons accept `className`; use Tailwind's `!` modifier when overriding a typography default (for example, `!text-[12px]`). Keep complete class names in conditional branches so Tailwind can discover them. Style props are reserved for runtime values (animated transforms, avatar/icon dimensions, creation colors) and navigator options that do not accept classes.

After installing dependencies or changing Babel/Metro configuration, restart with `npx expo start --clear`. `global.css` is imported once from the root layout; components do not import a separate styles folder.

## Supabase accounts

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`), then restart Expo. Use the project's public publishable key, never a service-role key.

The account sheet uses `components/Auth.tsx` for email/password sign-in and registration, and `components/Account.tsx` for profile editing and sign-out. Sessions persist across app restarts. If email confirmation is enabled in Supabase, confirm the email and then sign in here; a confirmation-only response does not sign the user in. Configure a valid Site URL for the confirmation page in Supabase Auth.

Profile editing requires a `public.profiles` table with `id` (UUID referencing `auth.users`), `username`, `website`, and `updated_at`. Apply `supabase/migrations/20260926000100_profiles.sql` to a new project, or ensure your existing table has equivalent owner-only select/insert/update policies. This migration is provided locally and has not been applied to a remote project. A profile is created on the first save; no signup trigger or avatar bucket is required. Existing avatar data is preserved.

The account sheet keeps its brown styling, slide-up transition, and flush bottom edge. Community creations and Library saves are still session-only mockup data; authentication does not upload them to Supabase.

## Recording uploads

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_UPLOAD_URL` to your API's HTTPS upload endpoint, then restart Expo. This value is public app configuration; never place secrets in it.

After recording a take, tap **Upload recording**. The app sends a multipart `POST` with these fields:

| Field | Value |
| --- | --- |
| `audio` | Audio file: M4A on iOS/Android, browser recording format on web |
| `title` | Recording title |
| `durationMs` | Duration in milliseconds, serialized as text |

Any successful 2xx response marks the take as uploaded; no response body is required. The app leaves multipart boundary headers to `fetch`, prevents duplicate taps, and offers manual retry on failure. Requests time out after two minutes and are cancelled when the take is replaced, discarded, or the recorder unmounts. Cancellation cannot undo a file already received by the server.

The upload backend is not included. For web, it must allow the app origin via CORS. The upload request does not currently send a Supabase access token; wire your upload backend's authentication into `src/services/upload-recording.ts` when available. Uploads happen only when tapped, and recordings otherwise remain in session memory/device cache.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
