const PATHS = {
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  plus: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>
  ),
};

export function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="icon" aria-hidden="true" viewBox="0 0 24 24">
      {PATHS[name]}
    </svg>
  );
}
