import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AuthProvider from "./context/AuthProvider";
import { initializeFirebaseAppCheck } from "./lib/firebase";
import MaintenancePage from "./pages/MaintenancePage";
import "./index.css";

const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === "true";
initializeFirebaseAppCheck();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isMaintenanceMode ? (
      <MaintenancePage />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>
);
