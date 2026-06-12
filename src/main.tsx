import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import AuthProvider from "./context/AuthProvider";
import ThemeProvider from "./context/ThemeProvider";
import { initializeFirebaseAppCheck } from "./lib/firebase";
import MaintenancePage from "./pages/MaintenancePage";
import "./index.css";

const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === "true";
const marketingCapturePaths = new Set(["/marketing-assets", "/demo-terminal"]);
const isMarketingCaptureRoute =
  typeof window !== "undefined" && marketingCapturePaths.has(window.location.pathname);
const shouldShowMaintenancePage = isMaintenanceMode && !(import.meta.env.DEV && isMarketingCaptureRoute);
initializeFirebaseAppCheck();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      {shouldShowMaintenancePage ? (
        <BrowserRouter>
          <ThemeProvider>
            <MaintenancePage />
          </ThemeProvider>
        </BrowserRouter>
      ) : (
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      )}
    </HelmetProvider>
  </React.StrictMode>
);
