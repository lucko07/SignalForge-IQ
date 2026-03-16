import { Navigate, Route, Routes } from "react-router-dom";
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
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminSignalsPage from "./pages/AdminSignalsPage";
import UpgradePage from "./pages/UpgradePage";
import UpgradeSuccessPage from "./pages/UpgradeSuccessPage";
import UpgradeCancelPage from "./pages/UpgradeCancelPage";

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/signals" element={<SignalsPage />} />
        <Route path="/education" element={<EducationPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/upgrade"
          element={
            <ProtectedRoute>
              <UpgradePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upgrade/success"
          element={
            <ProtectedRoute>
              <UpgradeSuccessPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upgrade/cancel"
          element={
            <ProtectedRoute>
              <UpgradeCancelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requirePaidPlan>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/signals"
          element={
            <ProtectedRoute requireAdmin>
              <AdminSignalsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
