import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { NotificationProvider } from "@/components/NotificationManager";
import PerformanceMonitor from "@/components/PerformanceMonitor";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import TestTaskCreation from "@/pages/TestTaskCreation";
import AuthTestPage from "@/pages/AuthTestPage";


export default function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/test" element={
            <ProtectedRoute>
              <TestTaskCreation />
            </ProtectedRoute>
          } />
          <Route path="/auth-test" element={<AuthTestPage />} />
          <Route path="/other" element={
            <ProtectedRoute>
              <div className="text-center text-xl">Other Page - Coming Soon</div>
            </ProtectedRoute>
          } />
        </Routes>
            <Toaster position="top-right" richColors />
            <PerformanceMonitor />
          </Router>
        </AuthProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}
