// Stand-in for the Records API session endpoint, used only by the e2e web server.
// Signed in when the forwarded Cookie header contains `e2e-session=1`.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_SESSION_PORT ?? 3101);

createServer((req, res) => {
  const signedIn = (req.headers.cookie ?? "").includes("e2e-session=1");
  if (req.method === "GET" && req.url === "/session") {
    res.writeHead(signedIn ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify(signedIn ? { role: "player", email: "ana@example.com" } : {}));
    return;
  }
  if (req.method === "GET" && req.url === "/wallet") {
    res.writeHead(signedIn ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify(signedIn ? { balanceCredits: 1000 } : {}));
    return;
  }
  res.writeHead(404).end();
}).listen(port);
