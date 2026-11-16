import { StrictMode, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { ThemeScope } from "@lenso/ui";
import "@lenso/tokens/styles.css";
import "./styles.css";
import { App } from "./App";

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function Root() {
  const dark = useSyncExternalStore(
    (cb) => {
      darkQuery.addEventListener("change", cb);
      return () => darkQuery.removeEventListener("change", cb);
    },
    () => darkQuery.matches,
  );
  return (
    <ThemeScope theme={dark ? "dark" : "light"}>
      <div className="theme-root">
        <App />
      </div>
    </ThemeScope>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
