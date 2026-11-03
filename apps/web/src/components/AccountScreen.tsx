"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { WALLET_HREF } from "@/lib/shell";
import { RegisterForm } from "./RegisterForm";
import { SignInForm } from "./SignInForm";

type Mode = "sign-in" | "register";

const TABS: { id: Mode; label: string }[] = [
  { id: "sign-in", label: "Sign in" },
  { id: "register", label: "Create account" },
];

export function AccountScreen({
  initialMode,
  redirected = false,
  redirectTo = WALLET_HREF,
}: {
  initialMode: Mode;
  redirected?: boolean;
  redirectTo?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({
    "sign-in": null,
    register: null,
  });

  function onTabKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = mode === "sign-in" ? "register" : "sign-in";
    setMode(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="account stack stack-4">
      <h1>Account</h1>
      {redirected && (
        <div className="alert alert-info" role="status">
          <span>Sign in to see your wallet.</span>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Account mode">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            className="tab"
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={mode === tab.id}
            aria-controls="account-panel"
            tabIndex={mode === tab.id ? 0 : -1}
            onClick={() => setMode(tab.id)}
            onKeyDown={onTabKeyDown}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div id="account-panel" role="tabpanel" aria-labelledby={`tab-${mode}`}>
        {mode === "sign-in" ? (
          <SignInForm email={email} onEmailChange={setEmail} redirectTo={redirectTo} />
        ) : (
          <RegisterForm
            email={email}
            onEmailChange={setEmail}
            onSignInInstead={() => setMode("sign-in")}
          />
        )}
      </div>
    </div>
  );
}
