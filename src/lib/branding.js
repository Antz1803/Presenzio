import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import { onValue, ref, runTransaction, update } from "firebase/database";
import fallbackLogo from "../assets/Logo.png";
import { db } from "./Firebase";

export const DEFAULT_BRANDING = {
  appName: "Presenzio",
  tagline: "A calmer way to teach",
  loginTitle: "Keep every class moving forward.",
  loginDescription:
    "One focused workspace for attendance, assessments, grades, and the people who make learning happen.",
  accentColor: "#4d47d9",
  logoUrl: "",
  logoWidth: 200,
  logoHeight: 200,
  logoMarginTop: 0,
  logoMarginRight: 0,
  logoMarginBottom: 0,
  logoMarginLeft: 0,
};

const BrandingContext = createContext({
  branding: { ...DEFAULT_BRANDING, logo: fallbackLogo },
  loading: false,
  saveBranding: async () => {},
  resetBranding: async () => {},
});

function cleanBranding(value = {}) {
  const next = { ...DEFAULT_BRANDING };
  Object.keys(DEFAULT_BRANDING).forEach((key) => {
    if (typeof value[key] === "string") next[key] = value[key].trim();
  });
  [
    "logoWidth",
    "logoHeight",
    "logoMarginTop",
    "logoMarginRight",
    "logoMarginBottom",
    "logoMarginLeft",
  ].forEach((key) => {
    const size = Number(value[key]);
    if (Number.isFinite(size)) {
      const minimum = key.startsWith("logoMargin") ? 0 : 24;
      const maximum = key.startsWith("logoMargin") ? 200 : 320;
      next[key] = Math.min(maximum, Math.max(minimum, Math.round(size)));
    }
  });
  if (!/^#[0-9a-f]{6}$/i.test(next.accentColor)) {
    next.accentColor = DEFAULT_BRANDING.accentColor;
  }
  if (next.logoUrl && !/^https?:\/\//i.test(next.logoUrl) && !next.logoUrl.startsWith("data:image/")) {
    next.logoUrl = "";
  }
  return next;
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(Boolean(db));

  useEffect(() => {
    if (!db) return undefined;
    return onValue(
      ref(db, "siteSettings/branding"),
      (snapshot) => {
        setBranding(cleanBranding(snapshot.val() || {}));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  const value = useMemo(() => {
    const normalized = cleanBranding(branding);
    return {
      branding: { ...normalized, logo: normalized.logoUrl || fallbackLogo },
      brandStyle: {
        "--presenzio-brand": normalized.accentColor,
        "--presenzio-brand-dark": normalized.accentColor,
        "--presenzio-brand-soft": `${normalized.accentColor}1c`,
      },
      loading,
      async saveBranding(next) {
        const safe = cleanBranding(next);
        if (!db) throw new Error("Firebase Realtime Database is not configured.");
        await update(ref(db, "siteSettings/branding"), safe);
        setBranding(safe);
      },
      async ensureBranding(isAdmin) {
        if (!db || !isAdmin) return;
        await runTransaction(ref(db, "siteSettings/branding"), (current) =>
          current ?? DEFAULT_BRANDING,
        );
      },
      async resetBranding() {
        if (!db) throw new Error("Firebase Realtime Database is not configured.");
        await update(ref(db, "siteSettings/branding"), DEFAULT_BRANDING);
        setBranding(DEFAULT_BRANDING);
      },
    };
  }, [branding, loading]);

  return createElement(
    BrandingContext.Provider,
    { value },
    createElement("div", { className: "branding-shell", style: value.brandStyle }, children),
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
