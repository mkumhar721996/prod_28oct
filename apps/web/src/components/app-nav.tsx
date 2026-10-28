"use client";

import { useState } from "react";

export function AppNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn btn-secondary btn-sm shell-menu-btn"
        type="button"
        aria-controls="main-nav"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Menu
      </button>
      <nav className="shell-nav" id="main-nav" aria-label="Main">
        <a href="/" data-nav-key="home" aria-current="page">
          Home
        </a>
      </nav>
    </>
  );
}
