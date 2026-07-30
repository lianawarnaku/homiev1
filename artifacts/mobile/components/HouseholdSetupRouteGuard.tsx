import { router, usePathname } from "expo-router";
import React, { useEffect, useRef } from "react";

import { useAppContextSelector } from "@/context/AppContext";

export function HouseholdSetupRouteGuard() {
  const pathname = usePathname();
  const setupStep = useAppContextSelector((context) => context.householdSetupStep);
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!setupStep) {
      lastRedirectRef.current = null;
      return;
    }
    const allowed =
      pathname === "/sweet-setup" ||
      (setupStep === "essentials" && pathname === "/planning");
    if (allowed) {
      lastRedirectRef.current = null;
      return;
    }
    const target = "/sweet-setup";
    const redirectKey = `${setupStep}:${pathname}:${target}`;
    if (lastRedirectRef.current === redirectKey) return;
    lastRedirectRef.current = redirectKey;
    router.replace(target as never);
  }, [pathname, setupStep]);

  return null;
}
