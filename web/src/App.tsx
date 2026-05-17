/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import Dashboard from "./pages/Dashboard";
import Monitor from "./pages/Monitor";
import Alerts from "./pages/Alerts";
import Devices from "./pages/Devices";
import Evidence from "./pages/Evidence";
import Analysis from "./pages/Analysis";
import Maintenance from "./pages/Maintenance";
import Audit from "./pages/Audit";
import Login from "./pages/Login";
import ModelTraining from "./pages/ModelTraining";
import Layout from "./components/Layout";
import AppErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./components/Toast";
import { AuthProvider, useAuth } from "./lib/auth";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { authenticated, login } = useAuth();

  return (
    <Routes>
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
        <Route path="/" element={<Navigate to="/monitor" />} />
      </Route>
      <Route path="*" element={<Navigate to="/monitor" />} />
    </Routes>
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
