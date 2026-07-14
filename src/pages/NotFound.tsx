import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { RouteHead } from "@/components/RouteHead";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <RouteHead
        title="Sayfa bulunamadı (404) — ElifMim"
        description="Aradığın sayfa bulunamadı. Ana sayfaya dönerek Elifbâ öğrenmeye devam edebilirsin."
        noindex
      />
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
