import type React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import Targets from "./pages/Targets";
import ClientTargets from "./pages/ClientTargets";
import Jobs from "./pages/Jobs";
import Analytics from "./pages/Analytics";
import FeedPage from "./pages/social/FeedPage";
import SearchPage from "./pages/social/SearchPage";
import ProfilePage from "./pages/social/ProfilePage";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route
                        path="/"
                        element={<Navigate to="/dashboard" replace />}
                      />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/targets" element={<Targets />} />
                      <Route
                        path="/client-targets"
                        element={<ClientTargets />}
                      />
                      <Route path="/jobs" element={<Jobs />} />
                      <Route path="/analytics" element={<Analytics />} />

                      {/* Social Client Routes */}
                      <Route path="/social" element={<FeedPage />} />
                      <Route path="/social/search" element={<SearchPage />} />
                      <Route
                        path="/social/profile/:fid"
                        element={<ProfilePage />}
                      />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
