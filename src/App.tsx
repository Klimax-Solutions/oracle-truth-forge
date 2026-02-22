import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SetupDetail from "./pages/SetupDetail";
import OracleM from "./pages/OracleM";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import EarlyAccess from "./pages/EarlyAccess";
import SetupPasswordPage from "./pages/SetupPasswordPage";
import { SuccessNotification } from "./components/dashboard/SuccessNotification";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup/:setupId" element={<SetupDetail />} />
          <Route path="/oracle-m" element={<OracleM />} />
          <Route path="/early-access" element={<EarlyAccess />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <SuccessNotification />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
