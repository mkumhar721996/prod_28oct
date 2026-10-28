import { expect, it } from "vitest";
import { readHeroFields } from "./heroFields";

it("maps title, text, cta and image", () => {
  const fields = readHeroFields(
    {
      type: "hero_split",
      field_title: "T",
      field_text: "X",
      field_cta: { uri: "/plan", title: "Go" },
      field_hero_image: { url: "/a.jpg", alt: "A" },
    },
    "field_hero_image",
  );
  expect(fields).toEqual({
    title: "T",
    text: "X",
    cta: { href: "/plan", label: "Go" },
    image: { src: "/a.jpg", alt: "A" },
  });
});

it("returns empty values for missing fields", () => {
  expect(readHeroFields({ type: "hero_split" }, "field_hero_image")).toEqual({
    title: "",
    text: "",
    cta: null,
    image: null,
  });
});

it("ignores a cta without a uri and an image without a url", () => {
  const fields = readHeroFields(
    { type: "hero_split", field_cta: { title: "Go" }, field_hero_image: { alt: "A" } },
    "field_hero_image",
  );
  expect(fields.cta).toBeNull();
  expect(fields.image).toBeNull();
});

const ctaFor = (uri: string) =>
  readHeroFields({ type: "hero_split", field_cta: { uri, title: "Go" } }, "field_hero_image").cta;
const imageFor = (url: string) =>
  readHeroFields({ type: "hero_split", field_hero_image: { url } }, "field_hero_image").image;

it.each([
  ["internal:/plan", "/plan"],
  ["/plan", "/plan"],
  ["https://example.com/a", "https://example.com/a"],
  ["http://example.com/a", "http://example.com/a"],
  ["mailto:a@example.com", "mailto:a@example.com"],
  ["tel:+123", "tel:+123"],
])("accepts cta uri %s as %s", (uri, href) => {
  expect(ctaFor(uri)).toEqual({ href, label: "Go" });
});

it.each([
  "javascript:alert(1)",
  " JavaScript:alert(1)",
  "data:text/html,x",
  "entity:node/1",
  "//evil.example/x",
  "internal:",
])("drops cta uri %s", (uri) => {
  expect(ctaFor(uri)).toBeNull();
});

it("drops image urls with unsafe schemes and keeps http(s) and relative ones", () => {
  expect(imageFor("javascript:alert(1)")).toBeNull();
  expect(imageFor("data:image/png;base64,AA")).toBeNull();
  expect(imageFor("/a.jpg")).toEqual({ src: "/a.jpg", alt: "" });
  expect(imageFor("https://cdn.example.com/a.jpg")?.src).toBe("https://cdn.example.com/a.jpg");
});

it("defaults a missing alt to an empty string", () => {
  const fields = readHeroFields(
    { type: "hero_split", field_hero_image: { url: "/a.jpg" } },
    "field_hero_image",
  );
  expect(fields.image).toEqual({ src: "/a.jpg", alt: "" });
});
