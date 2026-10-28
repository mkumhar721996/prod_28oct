// Minimal Records API stand-in for Playwright. The /hr page loads hires on the server, where
// page.route cannot intercept, so tests set what GET /hires returns via PUT /__state:
//   { "hires": [...] }  -> 200 with that list      { "down": true } -> 500
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 4100);
let state = { hires: [], down: false };

createServer((req, res) => {
  const json = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "PUT" && req.url === "/__state") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      state = { hires: [], down: false, ...JSON.parse(raw || "{}") };
      json(200, state);
    });
  } else if (req.method === "GET" && req.url === "/hires") {
    state.down ? json(500, {}) : json(200, state.hires);
  } else {
    json(404, {});
  }
}).listen(port);
