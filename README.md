# Welcome to your Expo app 👋

## Recording uploads

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_UPLOAD_URL` to your API's HTTPS upload endpoint, then restart Expo. This value is public app configuration; never place secrets in it.

After recording a take, tap **Upload recording**. The app sends a multipart `POST` with these fields:

| Field | Value |
| --- | --- |
| `audio` | Audio file: M4A on iOS/Android, browser recording format on web |
| `title` | Recording title |
| `durationMs` | Duration in milliseconds, serialized as text |

Any successful 2xx response marks the take as uploaded; no response body is required. The app leaves multipart boundary headers to `fetch`, prevents duplicate taps, and offers manual retry on failure. Requests time out after two minutes and are cancelled when the take is replaced, discarded, or the recorder unmounts. Cancellation cannot undo a file already received by the server.

The backend is not included. For web, it must allow the app origin via CORS. The existing demo sign-in does not provide API authentication; wire your backend's authentication into `src/services/upload-recording.ts` when available. Uploads happen only when tapped, and recordings otherwise remain in session memory/device cache.

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
