import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE = "https://elifmim.com";

interface RouteHeadProps {
  title: string;
  description: string;
  path?: string; // override path; defaults to current location
  noindex?: boolean;
}

/**
 * Per-route <head> tags. Sets a unique title, description, canonical and
 * og:title/og:description/og:url so each route self-references itself.
 * Sitewide fallbacks stay in index.html for social-preview crawlers.
 */
export function RouteHead({ title, description, path, noindex }: RouteHeadProps) {
  const loc = useLocation();
  const p = path ?? loc.pathname ?? "/";
  const url = `${SITE}${p === "/" ? "/" : p}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex && <meta name="robots" content="noindex" />}
    </Helmet>
  );
}
