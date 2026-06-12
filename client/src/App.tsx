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
import JobsHubPage from './pages/JobsHubPage';
import JobDiscoveryPage from './pages/JobDiscoveryPage';
import ResumePage from './pages/ResumePage';
import SalaryHubPage from './pages/SalaryHubPage';
import CompliancePage from './pages/CompliancePage';
import AssistantPage from './pages/AssistantPage';
import PracticePage from './pages/PracticePage';
import AdminPage from './pages/AdminPage';
import NetworkingHubPage from './pages/NetworkingHubPage';
import MockInterviewPage from './pages/MockInterviewPage';
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
          <Route path="/jobs" element={<ErrorBoundary><JobsHubPage initialTab="tracker" /></ErrorBoundary>} />
          <Route path="/analytics" element={<ErrorBoundary><JobsHubPage initialTab="analytics" /></ErrorBoundary>} />
          <Route path="/resume" element={<ErrorBoundary><ResumePage /></ErrorBoundary>} />
          <Route path="/salary" element={<ErrorBoundary><SalaryHubPage initialTab="salary" /></ErrorBoundary>} />
          <Route path="/companies" element={<ErrorBoundary><SalaryHubPage initialTab="companies" /></ErrorBoundary>} />
          <Route path="/compliance" element={<ErrorBoundary><CompliancePage /></ErrorBoundary>} />
          <Route path="/assistant" element={<ErrorBoundary><AssistantPage /></ErrorBoundary>} />
          <Route path="/referrals" element={<ErrorBoundary><NetworkingHubPage initialTab="referrals" /></ErrorBoundary>} />
          <Route path="/practice" element={<ErrorBoundary><PracticePage /></ErrorBoundary>} />
          <Route path="/admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
          <Route path="/interviews" element={<ErrorBoundary><MockInterviewPage /></ErrorBoundary>} />
          <Route path="/networking" element={<ErrorBoundary><NetworkingHubPage initialTab="networking" /></ErrorBoundary>} />
          <Route path="/profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
