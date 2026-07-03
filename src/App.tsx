import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Subject from "./pages/Subject.tsx";
import Topic from "./pages/Topic.tsx";
import Games from "./pages/Games.tsx";
import Game from "./pages/Game.tsx";
import Progress from "./pages/Progress.tsx";
import Settings from "./pages/Settings.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Paywall from "./pages/Paywall.tsx";
import Admin from "./pages/Admin.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { BottomNav } from "@/components/BottomNav";
import { ConsentModal } from "@/components/ConsentModal";
import { CapacitorBackHandler } from "@/components/CapacitorBackHandler";

import { installAudioUnlock } from "@/lib/audio";

const queryClient = new QueryClient();

const AppShell = () => {
  useEffect(() => {
    installAudioUnlock();
  }, []);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CapacitorBackHandler />
          <SubscriptionProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/giris" element={<Auth />} />
              <Route path="/sifre-sifirla" element={<ResetPassword />} />
              <Route path="/abonelik" element={<Paywall />} />
              <Route path="/konu/:subjectId" element={<Subject />} />
              <Route path="/konu/:subjectId/:topicId" element={<Topic />} />
              <Route path="/oyunlar" element={<Games />} />
              <Route path="/oyunlar/:gameId" element={<Game />} />
              <Route path="/ilerleme" element={<Progress />} />
              <Route path="/ayarlar" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/gizlilik" element={<PrivacyPolicy />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
            <ConsentModal />
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppShell />
  </QueryClientProvider>
);

export default App;
