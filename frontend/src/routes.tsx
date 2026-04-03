import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { HomePage } from "./pages/HomePage";
import { DashboardPage } from "./pages/DashboardPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { ArticleListPage } from "./pages/ArticleListPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { EmployeeManagementPage } from "./pages/crm/EmployeeManagementPage";
import { SalesRegistrationPage } from "./pages/crm/SalesRegistrationPage";
import { ServiceRegistrationPage } from "./pages/crm/ServiceRegistrationPage";
import { GroomingRegistrationPage } from "./pages/crm/GroomingRegistrationPage";
import { SalesTrendPage } from "./pages/crm/SalesTrendPage";
import { GenerationResultsPage } from "./pages/GenerationResultsPage";
import { RouteErrorPage } from "./pages/error/RouteErrorPage";
import { useAuthStore } from "./store/useAuthStore";

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteErrorPage />,
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: HomePage },
      { path: "dashboard", Component: DashboardPage },
      { path: "workspace", Component: WorkspacePage },
      { path: "articles", Component: ArticleListPage },
      { path: "history", Component: HistoryPage },
      { path: "generation-results", Component: GenerationResultsPage },
      { path: "profile", Component: ProfilePage },
      
      // CRM Routes
      { path: "employees", Component: EmployeeManagementPage },
      { path: "crm/sales", Component: SalesRegistrationPage },
      { path: "crm/service", Component: ServiceRegistrationPage },
      { path: "crm/grooming", Component: GroomingRegistrationPage },
      { path: "crm/trends", Component: SalesTrendPage },
    ],
  },
  // Public Auth Routes
  { path: "/login", Component: LoginPage },
  { path: "/signup", Component: SignupPage },
  { path: "/forgot-password", Component: ForgotPasswordPage },
]);
