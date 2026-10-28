summary: |
  HR can open an Add new hire form from the dashboard button or the empty-state action, enter name, email, role and start date, and either press Send invite or Cancel. Send invite validates all four fields (and email format) in the browser, then POSTs to a new Records API endpoint `POST /hires` that re-validates, rejects a duplicate email with 409, stores the hire with status `invited`, and enqueues an invite on the existing `notifications.send` pg-boss queue. On success HR returns to the dashboard and sees a toast. Cancel discards input, sends nothing and returns to whichever dashboard state opened the form. Built test-first (vitest and jest unit tests, supertest e2e, Playwright for the UI flows) against the approved prototype PROD-28OCT-STORY-018-design.html. This revision adds edge-case coverage: malformed and boundary inputs, double submit, concurrent duplicates, enqueue failure, network failure, stale form state, toast replay, open-redirect on `from`, keyboard use and the narrow viewport. Delivering the email and the 'Invited' table row stay with the Invitations epic and the table story.
scope:
  - description: |
      Load the design tokens and the standard component classes (`.btn`, `.field`, `.input`, `.alert`, `.toast`, `.empty-state`, `.card`) into the web app, once, in its entry stylesheet. Today `apps/web/src/app/globals.css` contains only `@import "tailwindcss";` (line 1) and `layout.tsx` imports it (line 2), so no token is loaded yet. Add after the tailwind import:
      `@import "../../../../design-system/tokens.css";` and `@import "../../../../design-system/prototype-utils.css";`, then the `.shell-*` rules from design-system/app-shell.html (header, brand, nav, main, footer, 768px breakpoint). Add the story's local rules from the prototype (`.page` max-width 40rem, `.page-head`, `.crumbs`, `.form-actions`, `.hires`/`.table-wrap` with `overflow-wrap: anywhere`, toast centring) using only tokens.
      Tokens used: --color-border, --color-bg, --color-bg-subtle, --color-fg, --color-fg-muted, --color-primary, --color-focus, --color-danger, --space-1..4, --size-shell-max, --size-control, --border-width, --border-width-strong, --size-focus-offset, --radius-md, --font-size-sm/lg, --font-weight-medium/semibold.
    files:
      - apps/web/src/app/globals.css
    rationale: |
      UI guidelines require token-only styling and the prototype is built from these classes. Loading them once avoids per-screen CSS.
  - description: |
      App shell in the root layout, matching the prototype header: brand link "Web App" to `/`, a "Menu" button on narrow screens (client component, toggles `aria-expanded`), and a main nav containing only Home (`data-nav-key="home"`, `aria-current="page"`), then `<main class="shell-main">` and the footer "Web App". Replace the Tailwind body classes with `shell` markup. Keep the existing metadata.
    files:
      - apps/web/src/app/layout.tsx
      - apps/web/src/components/app-nav.tsx
    rationale: |
      The prototype and ui-guidelines both specify top-bar-only navigation. The Menu toggle is needed for the mobile collapse.
  - description: |
      Pure validation module shared by the form and its tests:
      `export type HireInput = { name: string; email: string; role: string; startDate: string };`
      `export type HireErrors = Partial<Record<keyof HireInput, string>>;`
      `export function validateHire(input: HireInput): HireErrors;`
      Trims name and email, so whitespace-only counts as missing. Messages copied from the prototype ("Enter the new hire’s full name.", "Enter a work email like name@example.com.", "Enter an email like name@example.com.", "Choose a role.", "Choose a start date."); email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (so `a@b`, `a b@c.co` and `a@@b.co` are invalid, `ada+x@example.com` is valid). Also export `ROLES = ["Engineer","Designer","Recruiter","Finance"]` (the prototype's options) and the duplicate message constant "A hire with this email already exists. Use a different email."
    files:
      - apps/web/src/lib/hires/validate.ts
      - apps/web/src/lib/hires/validate.test.ts
    rationale: |
      Covers AC 11, 13 as testable logic under the web app's existing vitest node environment, which has no DOM.
  - description: |
      Web client for the Records API: `export async function sendInvite(input: HireInput): Promise<{ ok: true; hire: Hire } | { ok: false; status: number; errors: HireErrors; formError?: string }>` calling `fetch("/api/hires", { method: "POST", ... })`. Map 400 and 409 bodies `{ errors: {...} }` to `ok:false`; a rejected fetch (network failure), a 5xx, or an unparseable body maps to `{ ok: false, status, errors: {}, formError: "We couldn't send the invite. Try again." }`. It never throws. Add a rewrite in `next.config.ts`: `/api/:path*` to `${process.env.RECORDS_API_URL ?? "http://localhost:4000"}/:path*` so the web app only talks to the Records API and needs no CORS.
    files:
      - apps/web/src/lib/hires/client.ts
      - apps/web/src/lib/hires/client.test.ts
      - apps/web/next.config.ts
    rationale: |
      Stack note says the web app calls the Records API only. A rewrite keeps the browser same-origin. Mapping every failure to a value keeps the form's error handling in one place.
  - description: |
      Add new hire page at `/hr/hires/new` (client component `AddHireForm`): breadcrumbs "New hires / Add new hire", h1 "Add new hire", a hidden `.alert.alert-danger` error summary (`role="alert"`, `tabindex="-1"`, focused on failed submit, text "Fix 1 field before sending the invite." / "Fix N fields before sending the invite."), then four `.field`s with visible labels: Full name (text), Work email (email, hint "We'll send the invite to this address."), Role (`<select class="input">` with "Choose a role" placeholder option plus ROLES), Start date (`type="date"`). Each has a `.field-error` paragraph wired through `aria-describedby`, and `.is-invalid` plus `aria-invalid` when in error. Form is `noValidate`, and name receives focus on open. Actions row: Cancel (`.btn.btn-ghost`, left) and Send invite (`.btn.btn-primary`, right, never disabled before submit).
      Submit behaviour: run `validateHire`; if any errors, show them, keep values, clear previous errors first, do not call the API (AC 11-13). Otherwise set an in-flight guard (a `useRef` flag, not only state, so a double click or Enter-then-click cannot fire twice), disable the button and relabel it "Sending invite…", then `sendInvite`. On 400 map `errors` onto the fields; on 409 set the email error to the duplicate message (AC 15-16); on `formError` show it in the summary alert and keep all values; in every failure case re-enable the button. On success `router.push("/hr?invited=<encodeURIComponent(email)>")` (AC 4-6). Values live only in component state, so reopening the form after Cancel or after a send always shows a blank form.
      Cancel and the breadcrumb link do `router.push(from)` without calling the API, where `from` comes from `?from=` and is accepted only when it equals `/hr`; any other value (absolute URL, `//host`, another path) falls back to `/hr` (AC 7-10).
    files:
      - apps/web/src/app/hr/hires/new/page.tsx
      - apps/web/src/components/add-hire-form.tsx
    rationale: |
      Direct build of the prototype 'Add new hire' screen (data-wf-ids hire-form, hire-name, hire-email, hire-role, hire-start-date, cancel-hire, submit-hire). The in-flight guard and the `from` whitelist are the two non-obvious safety behaviours.
  - description: |
      Dashboard entry/exit page at `/hr` (server component wrapper plus a small client `DashboardToast`). Shows h1 "New hires" and a `.btn.btn-primary` "Add new hire" link with the plus icon to `/hr/hires/new` (AC 1). When there are no hires it renders the `.empty-state.card` ("No new hires yet", "Add a hire and send their invite so onboarding can begin.", primary "Add new hire" action to the same route) (AC 2) and the empty state remains after Cancel (AC 10). When `?invited=` is present `DashboardToast` shows a `.toast` with `role="status"` and text `Invite sent to <email>` (rendered as text, never as HTML), hides it after about 4 seconds, and immediately calls `router.replace("/hr")` to strip the query so a reload or back navigation does not show the toast again (AC 6). The hires table, stats, birthdays and 'Invited' status belong to sibling stories; this page only lists hires minimally from the API if the endpoint exists and otherwise leaves a clearly marked slot.
    files:
      - apps/web/src/app/hr/page.tsx
      - apps/web/src/components/dashboard-toast.tsx
    rationale: |
      The story's entry and exit point. Scope is limited to the button, empty-state action and toast; see open questions on whether another story already owns /hr.
  - description: |
      Records API `hires` module. Files: `hires.controller.ts` (`@Post()` returning 201 with the stored hire, `@Get()` for the existing list shape), `hires.service.ts`, `hires.module.ts` registered in `app.module.ts`, `dto/create-hire.dto.ts`. Signatures:
      `create(input: unknown): Hire` first validates, with one per-field map for all problems at once, then checks for a duplicate, then stores, then invites.
      - 400 `BadRequestException({ errors })` when a field is missing, not a string, or whitespace-only; the email is malformed; the role is not one of the four roles; or `startDate` is not a real calendar date in `YYYY-MM-DD` form (`2026-02-30` and `11/02/2026` are rejected). An empty body, a non-object body and unknown extra keys are handled: the first two give 400 with all four errors, extras are ignored and never stored.
      - 409 `ConflictException({ errors: { email: "A hire with this email already exists. Use a different email." } })` when an existing hire has the same email, compared trimmed and case-insensitively. It is checked only after validation passes, so an invalid payload always returns 400.
      - On success it stores `{ id, name, email, role, startDate, status: "invited" }` with name and email trimmed, then calls `InvitePort.send({ hireId, name, email })`. If `send` throws, the stored hire is removed again and the API answers 502 `{ errors: {}, message }`, so a failed invite leaves no half-created hire and the same email can be retried.
      `InvitePort` is an injectable token whose default implementation enqueues a job on `notifications.send` (the queue constant already in services/worker/src/jobs/index.ts). Check and insert run synchronously in the in-memory repository, so two simultaneous POSTs with the same email give exactly one 201 and one 409. Failures never send (AC 11, 15). The repository is an in-memory `HiresRepository` interface implementation because the API has no database dependency yet (see open questions).
    files:
      - services/api/src/hires/hires.controller.ts
      - services/api/src/hires/hires.service.ts
      - services/api/src/hires/hires.module.ts
      - services/api/src/hires/hires.repository.ts
      - services/api/src/hires/invite.port.ts
      - services/api/src/hires/dto/create-hire.dto.ts
      - services/api/src/hires/hires.service.spec.ts
      - services/api/test/hires.e2e-spec.ts
      - services/api/src/app.module.ts
    rationale: |
      The invite must be sent from the server; the API is authoritative for validation and the duplicate rule (AC 4, 11, 15, 16). Email delivery itself is the Invitations epic's, so this story only enqueues through the existing notifications queue and port.
  - description: |
      Playwright flows against the running web app with `page.route("**/api/hires", ...)` stubbing the Records API, so UI behaviour is verified without the API process. Includes a shared `fillValid(page)` helper, a 375px-wide project/viewport case, and keyboard cases.
    files:
      - apps/web/tests/e2e/add-hire.spec.ts
    rationale: |
      The web vitest environment is `node` with no DOM or testing-library, and the plan adds no new test dependency; component behaviour (navigation, focus, toast) is therefore covered end-to-end.
tests:
  - |
    AC1 (Playwright, apps/web/tests/e2e/add-hire.spec.ts), written first and failing because /hr does not exist:
    ```ts
    await page.goto("/hr");
    await page.getByRole("link", { name: "Add new hire" }).click();
    await expect(page).toHaveURL(/\/hr\/hires\/new$/);
    await expect(page.getByRole("heading", { level: 1, name: "Add new hire" })).toBeVisible();
    ```
  - |
    AC2 (Playwright, empty state; the API list stub returns []):
    ```ts
    await page.route("**/api/hires", (r) => r.fulfill({ json: [] }));
    await page.goto("/hr");
    await page.locator(".empty-state").getByRole("link", { name: "Add new hire" }).click();
    await expect(page.getByRole("heading", { name: "Add new hire" })).toBeVisible();
    ```
  - |
    AC3 (Playwright):
    ```ts
    await page.goto("/hr/hires/new");
    for (const l of ["Full name", "Work email", "Role", "Start date"]) await expect(page.getByLabel(l)).toBeVisible();
    ```
  - |
    AC4 (jest unit, services/api/src/hires/hires.service.spec.ts):
    ```ts
    const invites = { send: jest.fn() };
    const svc = new HiresService(new InMemoryHiresRepository(), invites);
    svc.create({ name: "Ada", email: "ada@example.com", role: "Engineer", startDate: "2026-11-02" });
    expect(invites.send).toHaveBeenCalledWith(expect.objectContaining({ email: "ada@example.com" }));
    ```
    plus supertest `request(app.getHttpServer()).post("/hires").send(valid).expect(201)` whose body has `status: "invited"`.
  - |
    AC5 and AC6 (Playwright, POST stubbed to 201):
    ```ts
    await fillValid(page);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page).toHaveURL(/\/hr(\?.*)?$/);
    await expect(page.getByRole("status")).toHaveText("Invite sent to ada@example.com");
    ```
  - |
    AC7 and AC9 (Playwright; counts POSTs on the stub):
    ```ts
    let posts = 0; await page.route("**/api/hires", (r) => { if (r.request().method() === "POST") posts++; r.fulfill({ json: [] }); });
    await fillValid(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/hr$/);
    expect(posts).toBe(0);
    ```
  - |
    AC8 (Playwright): after Cancel the dashboard does not show the typed name.
    ```ts
    await expect(page.getByText("Ada Lovelace")).toHaveCount(0);
    ```
  - |
    AC10 (Playwright): with the list stubbed to [], open the form from the empty state, press Cancel, then:
    ```ts
    await expect(page.locator(".empty-state")).toBeVisible();
    ```
  - |
    AC11 (vitest, apps/web/src/lib/hires/validate.test.ts, plus jest in the API service spec):
    ```ts
    expect(validateHire({ name: "", email: "a@b.co", role: "Engineer", startDate: "2026-11-02" })).toEqual({ name: "Enter the new hire’s full name." });
    expect(validateHire({ name: "A", email: "not-an-email", role: "", startDate: "" })).toHaveProperty("email", "Enter an email like name@example.com.");
    ```
    API: `expect(() => svc.create({ ...valid, email: "bad" })).toThrow(BadRequestException); expect(invites.send).not.toHaveBeenCalled();` and supertest `.post("/hires").send({}).expect(400)`.
  - |
    AC12 (Playwright): submitting an empty form keeps the form open and keeps typed values.
    ```ts
    await page.getByLabel("Full name").fill("Ada");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page).toHaveURL(/\/hr\/hires\/new$/);
    await expect(page.getByLabel("Full name")).toHaveValue("Ada");
    ```
  - |
    AC13 (Playwright and vitest): one inline error per missing or invalid field, tied to its input.
    ```ts
    await expect(page.locator("#e-email")).toHaveText("Enter a work email like name@example.com.");
    await expect(page.getByLabel("Work email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toContainText("Fix 3 fields before sending the invite.");
    ```
  - |
    AC14 (Playwright): the button is enabled on the blank and the invalid form.
    ```ts
    await expect(page.getByRole("button", { name: "Send invite" })).toBeEnabled();
    ```
  - |
    AC15 (jest, API): with an existing hire "ada@example.com", create with "ADA@example.com " throws ConflictException and the invite port is not called.
    ```ts
    expect(() => svc.create({ ...valid, email: "ADA@example.com " })).toThrow(ConflictException);
    expect(invites.send).toHaveBeenCalledTimes(1);
    ```
    Supertest: second identical POST returns 409.
  - |
    AC16 (supertest and Playwright): API 409 body is `{ errors: { email: "A hire with this email already exists. Use a different email." } }`; with the POST stubbed to 409 the page shows
    ```ts
    await expect(page.locator("#e-email")).toHaveText("A hire with this email already exists. Use a different email.");
    ```
  - |
    Client mapping (vitest, apps/web/src/lib/hires/client.test.ts, fetch mocked with vi.stubGlobal): 409 resolves `{ ok: false, status: 409, errors: { email: "A hire with this email already exists. Use a different email." } }` and 201 resolves `{ ok: true, hire }`.
  - |
    Edge, email format (vitest, table-driven in validate.test.ts):
    ```ts
    it.each(["a@b", "a b@c.co", "a@@b.co", "@b.co", "a@.co", "ada@example"])("rejects %s", (email) => {
      expect(validateHire({ ...valid, email }).email).toBe("Enter an email like name@example.com.");
    });
    it.each(["ada+x@example.com", "a.b@sub.example.co", "  ada@example.com  "])("accepts %s", (email) => {
      expect(validateHire({ ...valid, email }).email).toBeUndefined();
    });
    ```
  - |
    Edge, whitespace-only values count as missing (vitest):
    ```ts
    expect(validateHire({ ...valid, name: "   ", email: "  " })).toEqual({
      name: "Enter the new hire’s full name.",
      email: "Enter a work email like name@example.com.",
    });
    ```
  - |
    Edge, all four fields missing at once gives four errors and the summary says "Fix 4 fields", while exactly one problem says "Fix 1 field" (singular). Playwright:
    ```ts
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByRole("alert")).toContainText("Fix 4 fields before sending the invite.");
    await expect(page.locator(".field-error:visible")).toHaveCount(4);
    ```
  - |
    Edge, fixing errors and resubmitting clears the stale ones (Playwright): after the failed submit above, fill every field validly, click Send invite, then (POST stubbed to 201) expect to reach `/hr`; and a second variant that fixes only the name and expects `#e-name` hidden while `#e-email` stays visible and the summary reads "Fix 3 fields".
  - |
    Edge, API rejects bad payloads with every error at once (supertest):
    ```ts
    await request(app.getHttpServer()).post("/hires").send({}).expect(400)
      .expect(({ body }) => expect(Object.keys(body.errors).sort()).toEqual(["email", "name", "role", "startDate"]));
    await request(app.getHttpServer()).post("/hires").send({ ...valid, name: 123 }).expect(400);
    await request(app.getHttpServer()).post("/hires").send("not json").expect(400);
    await request(app.getHttpServer()).post("/hires").send({ ...valid, role: "Wizard" }).expect(400);
    ```
  - |
    Edge, start date (jest): `2026-02-30`, `11/02/2026`, `2026-13-01` and `""` give `errors.startDate`; `2026-11-02` is accepted; a past date such as `2026-10-19` (the prototype's own fixture) is accepted, because no AC forbids it.
    ```ts
    expect(() => svc.create({ ...valid, startDate: "2026-02-30" })).toThrow(BadRequestException);
    expect(svc.create({ ...valid, email: "p@example.com", startDate: "2026-10-19" }).status).toBe("invited");
    ```
  - |
    Edge, validation wins over duplicate (jest): an existing hire plus a payload with the same email but a missing role throws BadRequestException (not Conflict), and the invite port is not called.
  - |
    Edge, duplicate matching (jest): `" Ada@Example.com"` after `"ada@example.com"` throws Conflict; same email with a different name, role and date also throws Conflict; the stored email is the trimmed original casing of the first hire.
  - |
    Edge, concurrent duplicates (supertest):
    ```ts
    const codes = (await Promise.all([post(valid), post(valid)])).map((r) => r.status).sort();
    expect(codes).toEqual([201, 409]);
    expect(invites.send).toHaveBeenCalledTimes(1);
    ```
  - |
    Edge, invite enqueue failure rolls back (jest):
    ```ts
    invites.send.mockRejectedValueOnce(new Error("queue down"));
    await expect(svc.create(valid)).rejects.toMatchObject({ status: 502 });
    expect(repo.findAll()).toEqual([]);
    await expect(svc.create(valid)).resolves.toMatchObject({ status: "invited" }); // same email can be retried
    ```
  - |
    Edge, unknown extra keys ignored (supertest): POST `{ ...valid, status: "complete", id: "x" }` returns 201 with `status: "invited"` and a server-generated id.
  - |
    Edge, double submit (Playwright): a slow stub (300 ms delay) and two rapid clicks send exactly one POST; the button reads "Sending invite…" and is disabled while in flight.
    ```ts
    await btn.dblclick();
    await expect(btn).toBeDisabled();
    await expect(page).toHaveURL(/\/hr/);
    expect(posts).toBe(1);
    ```
  - |
    Edge, network failure and 5xx (Playwright and vitest): `route.abort()` and a 500 stub both leave HR on the form with all four values intact, show "We couldn't send the invite. Try again." in the alert, re-enable Send invite, and a retry against a 201 stub succeeds. The vitest client test asserts `sendInvite` resolves, never rejects, with `formError` set.
  - |
    Edge, 400 from the API (Playwright): a stub returning `{ errors: { role: "Choose a role." } }` shows that message on the role field and keeps the form open, in case the server disagrees with the browser.
  - |
    Edge, stale form state (Playwright): type values, Cancel, open the form again and expect all four fields empty and no errors; after a successful send, open the form again and expect the same. Also cancel after validation errors are showing and expect a clean form on reopen.
  - |
    Edge, Cancel from the empty state with typed values (Playwright, list stub []): the empty state is shown, zero POSTs, and the toast is not visible.
  - |
    Edge, Cancel returns to the opener (Playwright): opened from the dashboard button, Cancel and the breadcrumb "New hires" both land on `/hr`; the same from the empty state.
  - |
    Edge, `from` whitelist (Playwright):
    ```ts
    for (const from of ["https://evil.example", "//evil.example", "/other", "javascript:alert(1)"]) {
      await page.goto(`/hr/hires/new?from=${encodeURIComponent(from)}`);
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page).toHaveURL(/\/hr$/);
    }
    ```
  - |
    Edge, toast lifecycle (Playwright, fake clock): the toast appears with the text, the URL is `/hr` right after (query stripped), a page reload shows no toast, and after `page.clock.fastForward(4500)` the toast is hidden. Going to `/hr` directly never shows a toast.
  - |
    Edge, hostile text (Playwright and vitest): a name of `<img src=x onerror=alert(1)>` and an email of `"><b>x</b>@example.com` are rejected or rendered as plain text; no element is injected into the toast. `/hr?invited=%3Cscript%3E` shows the literal text, not a script.
  - |
    Edge, long and unicode values (Playwright, 375px viewport): a 200-character name and an email of 60 characters, plus the name "Zoë Ó Briain 山田太郎", do not cause horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`) and are sent unchanged.
  - |
    Edge, narrow viewport (Playwright at 375x800): the "Menu" button is visible and the nav is hidden until it is pressed; the form fields, error summary and the two action buttons are all reachable and not clipped; at 768px the nav is inline.
  - |
    Edge, keyboard (Playwright): focus lands on Full name on open; pressing Enter inside the email field submits (and shows errors on a blank form); Tab order is name, email, role, start date, Cancel, Send invite; after a failed submit focus is on the error summary (`await expect(page.getByRole("alert")).toBeFocused()`); each error is announced through `aria-describedby` on its input.
  - |
    Edge, role select (Playwright): the placeholder "Choose a role" is selected by default and counts as missing; choosing each of the four roles sends that exact role string in the POST body.
  - |
    Edge, browser back (Playwright): after a successful send, Back does not resubmit and does not show a pre-filled form (it returns to a blank form or the previous page); no second POST is recorded.
  - |
    Edge, existing routes unchanged (supertest): `GET /health` still returns `{ status: "ok" }` and `GET /records` still returns `[]`, and the existing `home.spec.ts` heading check still passes with the new shell.
  - |
    Design conformance (manual reviewer check against the prototype): one `.btn-primary` per view, labels visible, errors use `.is-invalid` plus `.field-error` text, no hex or px literals in globals.css additions except the 768px media-query breakpoint copied from the shell.
assumptions_or_open_questions:
  - |
    The repository has no HR dashboard route yet (apps/web/src/app contains only layout.tsx, page.tsx and globals.css). This plan adds a minimal `/hr` page holding only the Add new hire button, the empty state and the toast. If another story (the dashboard or table story) lands first, merge into its page instead of creating a competing one.
  - |
    Persistence: services/api has no database dependency (package.json lists only nest, reflect-metadata and rxjs), although the stack lists PostgreSQL. This plan uses an in-memory `HiresRepository` behind an interface so a Postgres implementation can replace it. Please confirm whether this story must also add the Postgres table and migration. If so `### Data & rollout` must change and the points go up. A real database would also need a unique index on lower(email) to keep the concurrent-duplicate guarantee.
  - |
    Invite delivery is owned by the Invitations epic. This plan only enqueues `{ hireId, name, email }` on `notifications.send` through an `InvitePort`. The existing worker handler only logs, so no email actually leaves until that epic ships. Please confirm that is acceptable for AC 4, and who creates the queue and sender.
  - |
    The Records API listens on `process.env.PORT ?? 3000`, the same port as `next dev`. The plan assumes `RECORDS_API_URL` defaults to http://localhost:4000 and the API is run with PORT=4000 locally; confirm the port convention.
  - |
    Importing `design-system/tokens.css` from apps/web/src/app/globals.css reaches outside the Next.js app directory. If Next/Turbopack rejects it, fall back to a build-time copy of the two CSS files into apps/web/src/styles/. Not verified, as nothing was run.
  - |
    Role options come from the prototype (Engineer, Designer, Recruiter, Finance). Confirm that this is the real list or whether roles come from an HR-managed source. The API rejects any other role with 400.
  - |
    The prototype stores and validates the duplicate email against the local list. This plan makes the API authoritative (409) and the form shows the error after submit, so the duplicate error appears only after the round trip. Duplicate matching is case-insensitive and trimmed. Validation errors take priority over the duplicate error, so a form with a duplicate email and another invalid field shows only the other field's error until that is fixed.
  - |
    Failure handling is not specified by any AC. The plan shows a generic `.alert-danger` "We couldn't send the invite. Try again." for network failures, 5xx and a failed enqueue (API 502), keeps all values and stays on the form. If the enqueue fails the hire is rolled back so it is not left half-created; confirm the wording and that rollback is the wanted behaviour.
  - |
    No AC sets limits, so none are enforced: no maximum length for name or email, and a start date in the past is accepted (the prototype's own fixture has one). Proposed if wanted: name up to 100 and email up to 254 characters, and a start date no more than a set period in the past. Please say if any of these should be added, since each would be a new rule with its own message.
  - |
    Prototype detail vs AC wording: the prototype puts a visible error summary above the form in addition to the per-field errors AC 13 asks for; the plan keeps both. The toast text `Invite sent to <email>` is taken from the prototype; AC 6 only asks for a brief confirmation. The prototype also keeps hires in browser memory and shows the new hire in its table; the 'Invited' row is the table story's, so this plan does not render it.
  - |
    The success toast is carried by a `?invited=` query parameter, then stripped, so it survives the client navigation but not a reload. If the dashboard story introduces shared client state or a toast provider, switch to it.
  - |
    Deferred project questions (hires scale and table paging, and retention rules for new-hire personal details) do not change this story. Name, email, role and start date are stored with no retention rule or purge in this plan. Noted for the owners of those decisions. Nothing in the work item or deferred block asked for credentials, URLs or out-of-repo actions, so nothing was refused.
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: None. The API has no database and this change adds no migration; hires live in an in-memory repository, so there are no existing rows to preserve. (Revisit if the open question on Postgres is answered yes.)
  - **Backfill / seed**: None.
  - **Settings**: `RECORDS_API_URL` for the web app rewrite, default `http://localhost:4000`, documented where the web app's env is documented (add a line to apps/web next.config.ts comments).
  - **Provisioning**: the `notifications.send` queue must exist in pg-boss for invites to be consumed; the worker already declares it in services/worker/src/jobs/index.ts.
  - **Order and rollback**: deploy the API first, then the web app (the web page calls `POST /hires`). Rolling back is safe, since nothing persistent is created. In-memory hires are lost on API restart; that is a known limit until a database is added.

  ### Findings from reading the code
  - Web: Next 16, React 19, Tailwind 4; vitest runs in `node` and only picks up `src/**/*.test.ts(x)`; Playwright config and `tests/e2e/home.spec.ts` exist.
  - Tokens: `globals.css` only has `@import "tailwindcss";`, and `layout.tsx:2` imports it. Nothing loads design-system/tokens.css today, hence the first scope item.
  - API: Nest 11, `RecordsModule` and `AppController` registered in `app.module.ts`; unit specs `*.spec.ts` under src, e2e in `test/*.e2e-spec.ts` with supertest.
  - Worker: pg-boss `jobs` array with `NOTIFICATIONS_QUEUE = 'notifications.send'` and a logging handler.
  - Prototype: a single column `.page` (40rem) with breadcrumbs, h1, error summary, four fields, Cancel (ghost, left) and Send invite (primary, right); toast on dashboard; Send invite is never disabled up front; sending state relabels to "Sending invite…".

  ### Edge-case decisions
  - Order of checks on the server is fixed: shape and field validation (400), then duplicate (409), then store, then enqueue (502 with rollback). Nothing is sent on any failure.
  - Client-side validation is a fast path only; the API re-validates every rule, so a client bypass cannot create a bad hire.
  - The double-submit guard is a ref, because state updates are asynchronous and two clicks can land before a re-render.
  - `from` is whitelisted to `/hr` to avoid an open redirect through the Cancel link.

  ```mermaid
  flowchart TD
    layout[apps/web layout.tsx]:::touched -->|shell + nav| globals[globals.css]:::touched
    globals -->|imports| tokens[design-system tokens.css and prototype-utils.css]
    layout --> hr[hr/page.tsx]:::touched
    hr -->|Add new hire| form[add-hire-form.tsx]:::touched
    form --> validate[lib/hires/validate.ts]:::touched
    form --> client[lib/hires/client.ts]:::touched
    client -->|rewrite /api| nextcfg[next.config.ts]:::touched
    nextcfg --> ctrl[hires.controller.ts]:::touched
    appmod[app.module.ts]:::touched --> hiresmod[hires.module.ts]:::touched
    hiresmod --> ctrl
    ctrl --> svc[hires.service.ts]:::touched
    svc --> repo[hires.repository.ts]:::touched
    svc --> invite[invite.port.ts]:::touched
    invite -->|enqueue| queue[worker jobs/index.ts NOTIFICATIONS_QUEUE]
    classDef touched fill:#f96,color:#000
  ```
review_focus: |
  IN: the Add new hire form, its entry points (dashboard button, empty state), Cancel and Send invite behaviour, client and server validation, the duplicate-email 409, the toast, and the minimal `POST /hires` plus enqueue with rollback on failure. OUT: the hires table and 'Invited' status, dashboard stats, real email delivery and sign-in, any database or retention work, and any length or past-date rules no AC asks for. Riskiest areas are the server check order (validation, then duplicate, then store, then invite, so nothing is sent on a failure), the double-submit guard, and that Cancel never calls the API. Deliberate choices: an in-memory repository and a minimal `/hr` page because neither exists yet (flagged as open questions), the `from` whitelist, the stripped `?invited=` query, and UI interactions tested in Playwright because the web vitest environment has no DOM.
