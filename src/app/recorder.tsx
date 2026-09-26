import { Redirect } from "expo-router";

// Keep existing recorder links opening the unified story workspace.
export default function Recorder() {
  return <Redirect href="/create" />;
}
