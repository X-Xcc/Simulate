/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import Layout from "./components/Layout";
import AppErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./components/Toast";
import { AuthProvider, useAuth } from "./lib/auth";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Monitor = lazy(() => import("./pages/Monitor"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Devices = lazy(() => import("./pages/Devices"));
const Evidence = lazy(() => import("./pages/Evidence"));
const Analysis = lazy(() => import("./pages/Analysis"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Audit = lazy(() => import("./pages/Audit"));
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const ModelTraining = lazy(() => import("./pages/ModelTraining"));
const Training = lazy(() => import("./pages/Training"));

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { authenticated, login } = useAuth();

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={
          authenticated ? <Navigate to="/monitor" replace /> : <Login onLogin={login} />
        } />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/monitor" element={<AppErrorBoundary><Monitor /></AppErrorBoundary>} />
          <Route path="/dashboard" element={<AppErrorBoundary><Dashboard /></AppErrorBoundary>} />
          <Route path="/alerts" element={<AppErrorBoundary><Alerts /></AppErrorBoundary>} />
          <Route path="/devices" element={<AppErrorBoundary><Devices /></AppErrorBoundary>} />
          <Route path="/evidence" element={<AppErrorBoundary><Evidence /></AppErrorBoundary>} />
          <Route path="/analysis" element={<AppErrorBoundary><Analysis /></AppErrorBoundary>} />
          <Route path="/maintenance" element={<AppErrorBoundary><Maintenance /></AppErrorBoundary>} />
          <Route path="/audit" element={<AppErrorBoundary><Audit /></AppErrorBoundary>} />
          <Route path="/model-training" element={<AppErrorBoundary><ModelTraining /></AppErrorBoundary>} />
          <Route path="/training" element={<AppErrorBoundary><Training /></AppErrorBoundary>} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Router>
              <AppRoutes />
            </Router>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
