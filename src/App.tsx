import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
const Topic = lazy(() => import("./pages/Topic.tsx"));
const Flashcard = lazy(() => import("./pages/Flashcard.tsx"));
const Games = lazy(() => import("./pages/Games.tsx"));
const Game = lazy(() => import("./pages/Game.tsx"));
const Progress = lazy(() => import("./pages/Progress.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Olcum = lazy(() => import("./pages/Olcum.tsx"));
const Deney = lazy(() => import("./pages/Deney.tsx"));
const Ezber = lazy(() => import("./pages/Ezber.tsx"));
const EzberCalis = lazy(() => import("./pages/EzberCalis.tsx"));
const Bahce = lazy(() => import("./pages/Bahce.tsx"));
const Koleksiyon = lazy(() => import("./pages/Koleksiyon.tsx"));
const YazilisHafiza = lazy(() => import("./pages/YazilisHafiza.tsx"));
const Prova = lazy(() => import("./pages/Prova.tsx"));
const Veli = lazy(() => import("./pages/Veli.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Paywall = lazy(() => import("./pages/Paywall.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
import { AuthProvider } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { BottomNav } from "@/components/BottomNav";
import { DebugHud } from "@/components/DebugHud";
import { RemedyOverlay } from "@/components/mnemonics/RemedyOverlay";
import { SkipOffer } from "@/components/SkipOffer";
import { ConsentModal } from "@/components/ConsentModal";
import { CapacitorBackHandler } from "@/components/CapacitorBackHandler";

import { SayfaYukleniyor } from "@/components/SayfaYukleniyor";

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
            <Suspense fallback={<SayfaYukleniyor />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/giris" element={<Auth />} />
              <Route path="/sifre-sifirla" element={<ResetPassword />} />
              <Route path="/abonelik" element={<Paywall />} />
              <Route path="/konu/:subjectId/:topicId" element={<Topic />} />
              <Route path="/konu/:subjectId/:topicId/flashcard" element={<Flashcard />} />
              <Route path="/oyunlar" element={<Games />} />
              <Route path="/oyunlar/:gameId" element={<Game />} />
              <Route path="/ezber" element={<Ezber />} />
              <Route path="/ezber/:suraId" element={<EzberCalis />} />
              <Route path="/bahce" element={<Bahce />} />
              <Route path="/koleksiyon" element={<Koleksiyon />} />
              <Route path="/yazilis-hafiza" element={<YazilisHafiza />} />
              <Route path="/prova" element={<Prova />} />
              <Route path="/prova/:suraId" element={<Prova />} />
              <Route path="/veli" element={<Veli />} />
              <Route path="/ilerleme" element={<Progress />} />
              <Route path="/ayarlar" element={<Settings />} />
              <Route path="/olcum" element={<Olcum />} />
              <Route path="/deney" element={<Deney />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/gizlilik" element={<PrivacyPolicy />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            <BottomNav />
            <DebugHud />
            <RemedyOverlay />
            <SkipOffer />
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
