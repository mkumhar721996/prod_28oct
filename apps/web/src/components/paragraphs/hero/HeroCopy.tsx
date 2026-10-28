import type { HeroFields } from "./heroFields";

export function HeroCopy({ title, text, cta }: Pick<HeroFields, "title" | "text" | "cta">) {
  return (
    <div className="hero-copy">
      <h1 className="hero-title">{title}</h1>
      <p className="hero-text">{text}</p>
      {cta ? (
        <a className="btn btn-primary" href={cta.href}>
          {cta.label}
        </a>
      ) : null}
    </div>
  );
}
