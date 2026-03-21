import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth/RouteGuards";
import { useAuthStore } from "@/stores/authStore";
import Dashboard from "./pages/Dashboard";
import CVScreening from "./pages/CVScreening";
import InterviewPipeline from "./pages/InterviewPipeline";
import VoiceInterview from "./pages/VoiceInterview";
import TechnicalInterview from "./pages/TechnicalInterview";
import Results from "./pages/Results";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthInitializer>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route
                path="/interview-pipeline"
                element={<InterviewPipeline />}
              />
              <Route path="/" element={<Dashboard />} />
              <Route path="/cv-screening" element={<CVScreening />} />
              <Route path="/voice-interview" element={<VoiceInterview />} />
              <Route
                path="/technical-interview"
                element={<TechnicalInterview />}
              />
              <Route path="/results" element={<Results />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthInitializer>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
