import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("exports every component file from the barrel", async () => {
  const typesDir = dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(typesDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(".tsx", ""));
  const exported = Object.keys(await import("./index"));
  for (const name of files) expect(exported).toContain(name);
});
