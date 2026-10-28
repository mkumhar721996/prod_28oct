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

it("defaults a missing alt to an empty string", () => {
  const fields = readHeroFields(
    { type: "hero_split", field_hero_image: { url: "/a.jpg" } },
    "field_hero_image",
  );
  expect(fields.image).toEqual({ src: "/a.jpg", alt: "" });
});
