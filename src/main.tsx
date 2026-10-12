import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyA11y } from "./ui/a11y.ts";

applyA11y();
import App from "./App.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
