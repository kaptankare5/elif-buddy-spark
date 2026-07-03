// RevenueCat wrapper. Web'de no-op — sadece Capacitor (native) ortamda çalışır.
// Rollup build'in @revenuecat/purchases-capacitor'u statik çözmesini engellemek için
// dinamik import `new Function` içinde saklanır.

const REVENUECAT_ANDROID_KEY = "goog_xIntzcDSNGbNiYpcSKXAYxCFRyQ";
export const ENTITLEMENT_ID = "endlessmum Pro";
export const OFFERING_ID = "default";

type Pkg = any;

let _mod: any | null = null;
let _initPromise: Promise<any | null> | null = null;

function isNative(): boolean {
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return !!w.Capacitor?.isNativePlatform?.();
}

async function loadModule(): Promise<any | null> {
  if (_mod) return _mod;
  if (!isNative()) return null;
  try {
    const pkg = ["@revenuecat", "purchases-capacitor"].join("/");
    const dynImport = new Function("p", "return import(p)") as (p: string) => Promise<any>;
    _mod = await dynImport(pkg);
    return _mod;
  } catch (e) {
    console.warn("[RC] load failed", e);
    return null;
  }
}

export async function initPurchases(): Promise<void> {
  if (!isNative()) return;
  if (_initPromise) { await _initPromise; return; }
  _initPromise = (async () => {
    const mod = await loadModule();
    if (!mod?.Purchases) return null;
    try {
      await mod.Purchases.configure({ apiKey: REVENUECAT_ANDROID_KEY });
    } catch (e) {
      console.warn("[RC] configure failed", e);
    }
    return mod;
  })();
  await _initPromise;
}

export async function loginPurchases(uid: string): Promise<void> {
  await initPurchases();
  const mod = await loadModule();
  if (!mod?.Purchases) return;
  try { await mod.Purchases.logIn({ appUserID: uid }); }
  catch (e) { console.warn("[RC] logIn failed", e); }
}

export async function logoutPurchases(): Promise<void> {
  const mod = await loadModule();
  if (!mod?.Purchases) return;
  try { await mod.Purchases.logOut(); }
  catch (e) { console.warn("[RC] logOut failed", e); }
}

export interface RcPackages {
  monthly: Pkg | null;
  yearly: Pkg | null;
  monthlyPrice: string | null;
  yearlyPrice: string | null;
}

export async function getOfferings(): Promise<RcPackages> {
  await initPurchases();
  const mod = await loadModule();
  const empty: RcPackages = { monthly: null, yearly: null, monthlyPrice: null, yearlyPrice: null };
  if (!mod?.Purchases) return empty;
  try {
    const res = await mod.Purchases.getOfferings();
    const offering = res?.current ?? res?.all?.[OFFERING_ID] ?? null;
    if (!offering) return empty;
    const monthly = offering.monthly ?? offering.availablePackages?.find((p: any) => p.identifier === "$rc_monthly") ?? null;
    const yearly = offering.annual ?? offering.availablePackages?.find((p: any) => p.identifier === "$rc_annual") ?? null;
    return {
      monthly,
      yearly,
      monthlyPrice: monthly?.product?.priceString ?? null,
      yearlyPrice: yearly?.product?.priceString ?? null,
    };
  } catch (e) {
    console.warn("[RC] getOfferings failed", e);
    return empty;
  }
}

export async function purchasePackage(pkg: Pkg): Promise<boolean> {
  const mod = await loadModule();
  if (!mod?.Purchases || !pkg) return false;
  try {
    const res = await mod.Purchases.purchasePackage({ aPackage: pkg });
    return !!res?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch (e: any) {
    if (!e?.userCancelled) console.warn("[RC] purchase failed", e);
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const mod = await loadModule();
  if (!mod?.Purchases) return false;
  try {
    const res = await mod.Purchases.restorePurchases();
    return !!res?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch (e) {
    console.warn("[RC] restore failed", e);
    return false;
  }
}

export async function hasProEntitlement(): Promise<boolean> {
  const mod = await loadModule();
  if (!mod?.Purchases) return false;
  try {
    const res = await mod.Purchases.getCustomerInfo();
    return !!res?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

export function isNativePlatform(): boolean {
  return isNative();
}

export type CustomerInfoListener = (isPro: boolean) => void;

export async function addCustomerInfoListener(cb: CustomerInfoListener): Promise<() => void> {
  const mod = await loadModule();
  if (!mod?.Purchases) return () => {};
  try {
    const handle = await mod.Purchases.addCustomerInfoUpdateListener((info: any) => {
      const active = !!info?.entitlements?.active?.[ENTITLEMENT_ID];
      cb(active);
    });
    return () => { try { handle?.remove?.(); } catch { /* ignore */ } };
  } catch {
    return () => {};
  }
}
