import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import AuthCallbackPage from './pages/auth/AuthCallbackPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage from './pages/JobsPage';
import JobDiscoveryPage from './pages/JobDiscoveryPage';
import ResumePage from './pages/ResumePage';
import SalaryPage from './pages/SalaryPage';
import CompliancePage from './pages/CompliancePage';
import CompaniesPage from './pages/CompaniesPage';
import AssistantPage from './pages/AssistantPage';
import ReferralsPage from './pages/ReferralsPage';
import PracticePage from './pages/PracticePage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminPage from './pages/AdminPage';
import NetworkingPage from './pages/NetworkingPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  return token ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public marketing landing — guests see it, authed users go to the app */}
        <Route path="/" element={<RequireGuest><LandingPage /></RequireGuest>} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
          <Route path="/register" element={<RequireGuest><RegisterPage /></RequireGuest>} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Route>

        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/job-discovery" element={<ErrorBoundary><JobDiscoveryPage /></ErrorBoundary>} />
          <Route path="/jobs" element={<ErrorBoundary><JobsPage /></ErrorBoundary>} />
          <Route path="/resume" element={<ErrorBoundary><ResumePage /></ErrorBoundary>} />
          <Route path="/salary" element={<ErrorBoundary><SalaryPage /></ErrorBoundary>} />
          <Route path="/compliance" element={<ErrorBoundary><CompliancePage /></ErrorBoundary>} />
          <Route path="/companies" element={<ErrorBoundary><CompaniesPage /></ErrorBoundary>} />
          <Route path="/assistant" element={<ErrorBoundary><AssistantPage /></ErrorBoundary>} />
          <Route path="/referrals" element={<ErrorBoundary><ReferralsPage /></ErrorBoundary>} />
          <Route path="/practice" element={<ErrorBoundary><PracticePage /></ErrorBoundary>} />
          <Route path="/analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
          <Route path="/admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
          <Route path="/interviews" element={<Navigate to="/practice" replace />} />
          <Route path="/networking" element={<ErrorBoundary><NetworkingPage /></ErrorBoundary>} />
          <Route path="/profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
