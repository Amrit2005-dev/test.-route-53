"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleTheme } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if ((mod && e.key.toLowerCase() === "k") || (e.altKey && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>('#aws-top-nav input[type="search"]') || document.querySelector<HTMLInputElement>('input[type="search"]');
        search?.focus();
      }

      if (mod && e.key === "/") {
        e.preventDefault();
        // shortcuts help — no toast spam
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        toggleTheme();
      }

      if (mod && e.key.toLowerCase() === "n" && pathname.includes("hosted-zones")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("route53:create"));
      }

      if (e.key === "g" && !mod) {
        const onG = (ev: KeyboardEvent) => {
          if (ev.key === "h") {
            ev.preventDefault();
            router.push("/hosted-zones");
          }
          window.removeEventListener("keydown", onG);
        };
        window.addEventListener("keydown", onG, { once: true });
        setTimeout(() => window.removeEventListener("keydown", onG), 1000);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, pathname, toggleTheme]);

  return null;
}
