import type { JSX } from "react";
import { Dashboard } from "@/views/Dashboard";
import { HourPrompt } from "@/views/HourPrompt";

function isPromptWindow(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("window") === "prompt";
}

export function App(): JSX.Element {
  if (isPromptWindow()) {
    return <HourPrompt />;
  }
  return <Dashboard />;
}
