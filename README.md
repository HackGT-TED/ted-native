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

## Recording timeline

Create is one continuous story workspace. Press and hold the fixed microphone button to begin capture; release to stop and automatically append a moment on the same page. The timeline and navigation fade during capture while the elapsed timer stays visible. Microphone permission and native preparation must complete before audio can begin; releasing during setup cancels capture. Existing `/recorder` links redirect to Create. Native duration is read before stopping (SDK 57 resets it on iOS), with finalized duration preferred where available. Takes shorter than 250 ms are rejected with an explanation.

`StudioProvider` owns the audio recorder and recording-segment state. Navigating away or backgrounding finishes an active take without disposing its recorder mid-save. Setup and stop operations are guarded against repeated taps. Only active capture polls the timer, every 250 ms. Touch cancellation and browser focus loss also end a hold; playback is paused and pending playback loads are cancelled before capture.

Finalized audio enters Create immediately. Metadata is serialized to AsyncStorage; native audio is recorded directly into the document directory, and browser audio bytes are retained in IndexedDB. Authenticated uploads run in the provider and continue across route changes. Failed uploads retain the local take and offer Retry saving. Guest takes stay on the device; after signing in, Create offers an explicit action to add them to the account's draft.

Create uses a virtualized timeline that starts in recording order, with date headers, timestamps, durations, progress, and subtle insertion animations. Hold a segment's handle to drag it into story order; the list scrolls near its edges. Tapping the handle exposes Move earlier/later controls, also available as accessibility actions. Order saves locally and syncs through the existing position field; new recordings append to the end. Navigation and backgrounding cancel an unfinished drag. One Expo Audio player serves the entire timeline: switching moments pauses the previous source and starts the new one from zero. Pausing the current moment preserves its position; replay after completion rewinds. Missing or unplayable local audio falls back to a short-lived signed URL from the private bucket. Navigation and backgrounding stop playback.

Raw recording segments remain separate from community creations. The old publishing form remains available through **Share a written creation** at `/share`. Explore and Library continue to use session-only demo creations and saves. Story generation is not implemented. A nullable `creation_session_id` reserves the association for future named story drafts; currently each account has one ongoing draft.

Segment cards lead with an editable name; recording time, duration, and date headings use smaller secondary text. Use the pencil to name a segment and the trash control to confirm removing it from the story. Local edits are immediate and survive restarts. Names and deletion markers sync to the account with retry controls. Deletions stop active playback and remain hidden even if an older upload or refresh finishes later. This is a soft deletion from the story timeline; audio files remain in private storage.

### Supabase setup

Apply these local migrations to the Supabase project in order:

1. `supabase/migrations/20260926000200_recordings.sql` — the existing private audio bucket and owner-only file policies.
2. `supabase/migrations/20260926000300_recording_segments.sql` — owner-only segment metadata, timeline index, and backfill of previous uploads that have valid duration metadata.
3. `supabase/migrations/20260926000400_segment_edits.sql` — owner-only updates for names, ordering, and persistent deletion markers. This migration has not been applied remotely.

The new migrations have **not** been applied remotely. Dragging uses `react-native-draggable-flatlist` with the existing Gesture Handler and Reanimated modules; Reanimated is pinned to Expo SDK 57's compatible version. Keep `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured on both app and API server; no service-role key is used.

The authenticated multipart `POST /api/recordings` still handles audio uploads, with `audio`, `title`, and `durationMs`, plus `id`, `recordedAt`, and `position` for timeline captures. Audio goes to `<user-id>/<segment-id>.<extension>` and metadata goes to `public.recording_segments`. Deterministic paths and insert-on-conflict-ignore metadata make retries safe after a lost response or metadata failure. Audio is never overwritten on retry. Native files are M4A; browsers keep their supported WebM/Ogg/MP4 format. The existing 25 MB upload limit remains.

No upload URL is needed during development: Expo resolves `/api/recordings` against its development server. For production, deploy the Expo server export and configure the Expo Router plugin's `origin`, or set `EXPO_PUBLIC_UPLOAD_URL` to the full HTTPS endpoint before building the native app. A native EAS build alone does not host this API. See [Expo API routes](https://docs.expo.dev/router/web/api-routes/). Cross-origin web hosting requires CORS for the app origin and Authorization header.

### Main implementation files

- `src/app/recorder.tsx`, `src/components/shell.tsx`: legacy recorder redirect and navigation that fades during capture.
- `src/app/create.tsx`, `src/components/recording/recording-timeline-item.tsx`: connected timeline and reusable recording card.
- `src/app/share.tsx`: preserved manual community publishing form.
- `src/context/studio.tsx`, `src/hooks/use-audio-capture.ts`, `src/hooks/use-recording-segments.ts`: capture lifecycle, optimistic state, persistence, account isolation, and retries.
- `src/hooks/use-timeline-playback.ts`, `src/services/recording-files.ts`: single-player playback and durable local/private remote files.
- `src/types/recording.ts`, `src/utils/recordings.ts`: typed segments, merge/sort behavior, and timestamp formatting.
- `src/services/upload-recording.ts`, `src/server/upload-recording.ts`: authenticated, idempotent uploads and metadata persistence.

The old hold-to-record and manual-upload hooks were replaced. Tests cover capture races, permissions, duration, interruption, playback switching, remote fallback, optimistic insertion, hydration, account isolation, upload retry, and serialized cache writes.

### Validation and device checks

Run `npx expo lint`, `npx tsc --noEmit`, and `node --test tests/*.test.cjs`. The web/server bundle can be checked with `npx expo export --platform web`.

Before release, test microphone capture on an iOS and Android development build: allow/deny permissions, record multiple takes, interrupt with background/navigation, retry while offline, restart, and play every take. Verify private storage and row policies against the configured Supabase project after applying the migration. Browser storage can be cleared by the user or unavailable in private browsing; persistence failures remain visible, and available bytes can still upload. A force-quit during an unfinished capture is not crash recovery. Automatic local-file pruning and named/multiple drafts are future work.

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
