import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import PricingPage from "./pages/PricingPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import SignalsPage from "./pages/SignalsPage";
import EducationPage from "./pages/EducationPage";
import FaqPage from "./pages/FaqPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage, { DashboardHomeContent } from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminSignalsPage from "./pages/AdminSignalsPage";
import PerformanceOverview from "./pages/dashboard/PerformanceOverview";
import TradesPage from "./pages/dashboard/TradesPage";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import AutomationPage from "./pages/dashboard/AutomationPage";
import AdminDataPage from "./pages/admin/AdminDataPage";
import UpgradePage from "./pages/UpgradePage";
import UpgradeSuccessPage from "./pages/UpgradeSuccessPage";
import UpgradeCancelPage from "./pages/UpgradeCancelPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import LegalConsentPage from "./pages/LegalConsentPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import { hasRequiredFirebaseClientConfig } from "./lib/firebase";

function App() {
  if (!hasRequiredFirebaseClientConfig) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          backgroundColor: "#f8fafc",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "640px",
            display: "grid",
            gap: "0.75rem",
            padding: "1.5rem",
            borderRadius: "20px",
            border: "1px solid #d0d5dd",
            backgroundColor: "#ffffff",
            boxShadow: "0 10px 30px rgba(16, 24, 40, 0.05)",
          }}
        >
          <h1 style={{ margin: 0, color: "#101828" }}>SignalForge IQ</h1>
          <p style={{ margin: 0, color: "#475467", lineHeight: 1.7 }}>
            The app is temporarily unavailable while setup is being completed. Please
            refresh the page again shortly.
          </p>
        </section>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/education" element={<EducationPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route
            path="/legal-consent"
            element={
              <ProtectedRoute>
                <LegalConsentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade"
            element={
              <ProtectedRoute requireLegalConsent>
                <UpgradePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade/success"
            element={
              <ProtectedRoute requireLegalConsent>
                <UpgradeSuccessPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade/cancel"
            element={
              <ProtectedRoute requireLegalConsent>
                <UpgradeCancelPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireLegalConsent>
                <DashboardPage />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHomeContent />} />
            <Route
              path="performance"
              element={
                <ProtectedRoute requirePro>
                  <PerformanceOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="trades"
              element={
                <ProtectedRoute requirePro>
                  <TradesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="analytics"
              element={
                <ProtectedRoute requirePro>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="automation"
              element={
                <ProtectedRoute requireAutomation redirectTo="/upgrade?plan=elite&from=automation">
                  <AutomationPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route
            path="/admin/signals"
            element={
              <ProtectedRoute requireAdmin requireLegalConsent>
                <AdminSignalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/data"
            element={
              <ProtectedRoute requireAdmin requireLegalConsent>
                <AdminDataPage />
              </ProtectedRoute>
            }
          />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
