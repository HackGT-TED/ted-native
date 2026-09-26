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

The Upload recording button sends an authenticated multipart `POST /api/recordings` to the Expo Router API route in `src/app/api/recordings+api.ts`. The handler verifies the Supabase access token and stores the audio in the private `recordings` bucket at `<user-id>/<generated-id>.<extension>`. The title and duration are saved as object user metadata. No service-role key is needed.

Before the first upload:

1. Apply `supabase/migrations/20260926000200_recordings.sql` in the Supabase SQL editor (or through your migration runner). This creates the private bucket, a 25 MB file limit, and policies allowing authenticated users to insert and read only their own files. The script is safe to re-run, including if the bucket was created manually. It has not been applied remotely by this code change.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, restart `npx expo start`, and sign in. These same variables must be set on the deployed API server.

No upload URL is required during development: Expo resolves `/api/recordings` against the dev server, including from a connected iPhone. `EXPO_PUBLIC_UPLOAD_URL` can optionally override the endpoint.

| Multipart field | Value |
| --- | --- |
| `audio` | Non-empty M4A, WebM, or Ogg file, up to 25 MB |
| `title` | Trimmed title, 1–80 characters |
| `durationMs` | Positive integer duration in milliseconds |

Send `Authorization: Bearer <Supabase access token>`; the app supplies it from the current session. Let `fetch` generate the multipart Content-Type boundary. A successful response has status `201` and JSON `{ id, bucket, path, title, durationMs, contentType, size }`. Files remain private; the response does not expose a public URL. Error responses contain `{ error }`: `400` for invalid fields/body, `401` for missing/invalid authentication, `403` for denied storage access, `413` for size limits, `415` for unsupported media, and `502`/`503` for storage/configuration failures.

The client prevents duplicate taps, offers manual retry, times out after two minutes, and cancels when the take is replaced, discarded, or the recorder unmounts. Cancellation cannot undo an upload already stored; a retry after a lost response can create another copy. Local discard does not delete an uploaded file. Uploading stores audio and metadata only; it does not publish a community creation.

For production, `web.output` is set to `server` so the API route is exported. Deploy the web/server export to a supported host, then set the Expo Router plugin's `origin` to that HTTPS server (or set `EXPO_PUBLIC_UPLOAD_URL` to its full `/api/recordings` URL) before building the native app. A native EAS build alone does not host this API. See [Expo API routes and deployment](https://docs.expo.dev/router/web/api-routes/). Cross-origin web hosting requires your host to allow the app origin and Authorization header via CORS.

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
