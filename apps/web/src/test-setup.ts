import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Interactive component tests opt in to a DOM with `// @vitest-environment jsdom` at the top of the file.
afterEach(cleanup);
