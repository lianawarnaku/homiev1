"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ConfirmationState = "checking" | "confirmed" | "error";

export default function ConfirmEmailPage() {
  const [state, setState] = useState<ConfirmationState>("checking");
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    let active = true;

    async function confirmEmail() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type") ?? "email";
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!tokenHash) {
        setState("error");
        setMessage("This confirmation link is missing its verification token.");
        return;
      }

      if (!supabaseUrl || !supabaseKey) {
        setState("error");
        setMessage("Email confirmation is temporarily unavailable. Please try again shortly.");
        return;
      }

      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token_hash: tokenHash, type }),
        });

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as
            | { msg?: string; message?: string }
            | null;
          throw new Error(result?.msg ?? result?.message ?? "The confirmation link is invalid or expired.");
        }

        if (!active) return;
        setState("confirmed");
        setMessage("Your email is confirmed. You can return to SweetMate and sign in.");
      } catch (error) {
        if (!active) return;
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "We could not confirm this email. Please request a new link from SweetMate.",
        );
      }
    }

    void confirmEmail();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="confirmation-shell">
      <section className="confirmation-card" aria-live="polite">
        <div className={`status-mark status-${state}`} aria-hidden="true">
          {state === "checking" ? <span className="spinner" /> : state === "confirmed" ? "✓" : "!"}
        </div>
        <p className="eyebrow">SweetMate account</p>
        <h1>
          {state === "checking"
            ? "One moment"
            : state === "confirmed"
              ? "You’re all set"
              : "That link didn’t work"}
        </h1>
        <p className="confirmation-copy">{message}</p>
        {state === "confirmed" ? (
          <a className="primary-button full-width" href="sweetmate://auth/callback">
            Open SweetMate
          </a>
        ) : null}
        {state === "error" ? (
          <p className="small-copy">
            Open SweetMate and choose <strong>Resend confirmation</strong> to receive a fresh link.
          </p>
        ) : null}
        <Link className="text-link centered" href="/">
          Return to sweetmate.info
        </Link>
      </section>
    </main>
  );
}
