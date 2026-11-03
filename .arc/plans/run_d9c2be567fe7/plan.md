summary: |
  Sign-in mostly exists already: SignInForm (apps/web/src/components/SignInForm.tsx) posts to POST /session/sign-in, the Records API trims and lower-cases the email, returns the same 401 "Email or password incorrect" for unknown email and wrong password, and the form already clears the error on resubmit and links to /register. The real gaps are (1) inline "required" messages beside an empty email or password field (AC8, AC9), which today fall through to the server and show a generic failure, and (2) the sketch's failed state, which puts the failure message beside the password field (`password-error`, password in error state) whereas the form shows it in a separate `.alert`. This plan closes those two gaps test-first and pins the already-working criteria (AC1-7, AC10) with regression tests, without touching the API.
scope:
  - description: |
      Add a sign-in-specific required check to the client library so the Sign in screen does not reuse the register format rules (a sign-in must not tell a player their password is "too short"):

      ```ts
      export const EMAIL_REQUIRED_ERROR = "Enter your email";
      export const PASSWORD_REQUIRED_ERROR = "Enter your password";
      export function validateSignInEmailRequired(email: string): string | null; // trim() === "" -> EMAIL_REQUIRED_ERROR
      export function validateSignInPasswordRequired(password: string): string | null; // "" -> PASSWORD_REQUIRED_ERROR
      ```
    files:
      - apps/web/src/lib/credentials.ts
      - apps/web/src/lib/credentials.test.ts
    rationale: |
      AC8/AC9. Only emptiness is checked, so email format and the 8 character minimum never block a sign-in (an existing player's credentials are checked by the API alone).
  - description: |
      Rework SignInForm to return field-level errors, mirroring RegisterForm (handleRegister / RegisterErrors / is-invalid + field-error / focus on first error).

      Before: `handleSignIn(deps, email, password, redirectTo): Promise<string | null>`
      After:
      ```ts
      export type SignInErrors = { email?: string; password?: string };
      export async function handleSignIn(deps, email, password, redirectTo = WALLET_HREF): Promise<SignInErrors>;
      ```
      Behaviour: empty email -> `{ email: EMAIL_REQUIRED_ERROR }`; else empty password -> `{ password: PASSWORD_REQUIRED_ERROR }` (no API call in either case); API failure with status 401 -> `{ password: SIGN_IN_FAILED_ERROR }` where `export const SIGN_IN_FAILED_ERROR = "Email or password is incorrect"` (the sketch's text, defined in the UI; the API's response body is NOT changed); any other failure (status 0, 429, 5xx) -> `{ password: result.message }`; so the failed message renders in the `.field-error` beside the password field with the password input `.is-invalid` and `aria-invalid` (sketch screen sign-in-error: password-error); success -> `replace(redirectTo)`, `refresh()`, `{}`. Keep: email retained and password cleared after a failure, pending state, the `redirected` info alert, and the "Create an account" link to REGISTER_HREF (sketch element create-account-link; sketch label kept). Errors are reset to `{}` at the start of each submit, which is what hides the failed message on a correct resubmit (AC5). Reuse the `.field`, `.input.is-invalid`, `.field-error`, `.btn-primary`, `.card`, `.alert-info`, `.link` classes already used in the file; no new component and no new tokens or colour literals. A network or non-credential failure (status 0 or 5xx) shows its message in the same password slot, as the generic message already comes from lib/session.ts.
    files:
      - apps/web/src/components/SignInForm.tsx
      - apps/web/src/components/AuthForms.test.tsx
    rationale: |
      Builds sketch screens `sign-in` and `sign-in-error` (state_of sign-in), the flow `sign-in-fail` (submit -> failed state, same screen) and exit flows `sign-in-done` (via redirectTo, kept as next-or-/wallet by reviewer decision, not the sketch's lobby) and `to-register`. The sketch pins the message beside the password field, so the separate `.alert` is replaced; this follows the UI guidelines (`.field-error` + `.is-invalid`, colour never the only signal, color-danger for errors).
  - description: |
      Playwright coverage of the visible journey against the existing mock session server: empty submit shows both inline required messages, a failed submit shows the message, then a correct submit hides it and lands signed in, and the Create an account link is visible. Extend the existing sign-in spec rather than adding a new harness.
    files:
      - apps/web/tests/e2e/player-accounts.spec.ts
    rationale: |
      End-to-end evidence for AC4/AC5/AC6/AC8/AC9; the file already stubs `**/session/sign-in` with page.route.
tests:
  - |
    AC1 (vitest, apps/web/src/components/AuthForms.test.tsx) - success navigates and returns no errors:
    ```ts
    const deps = { ...nav(), signInPlayer: vi.fn(async () => ({ ok: true as const })) };
    expect(await handleSignIn(deps, "a@b.co", "play-2026")).toEqual({});
    expect(deps.replace).toHaveBeenCalledWith("/wallet");
    expect(deps.refresh).toHaveBeenCalled();
    ```
  - |
    AC2 and AC10 (vitest) - an unknown email gets the same 401 message as a wrong password and the player stays put; in the API unit spec (services/api/src/session/session.controller.spec.ts) assert the two cases throw the identical UnauthorizedException:
    ```ts
    const failed = { ok: false as const, status: 401, message: "Email or password incorrect" };
    const deps = { ...nav(), signInPlayer: vi.fn(async () => failed) };
    expect(await handleSignIn(deps, "nobody@x.co", "whatever1")).toEqual({ password: "Email or password is incorrect" });
    expect(deps.replace).not.toHaveBeenCalled();
    ```
  - |
    AC3 (vitest) - wrong password puts the sketch's failed message in the password slot, even though the API body says "incorrect" (this test fails first, today it returns a bare string); a non-401 failure still shows its own message:
    ```ts
    expect(await handleSignIn(deps, "a@b.co", "nope-nope")).toEqual({ password: "Email or password is incorrect" });
    expect(await handleSignIn(downDeps, "a@b.co", "play-2026")).toEqual({ password: "Something went wrong. Try again." });
    ```
  - |
    AC4 (vitest) - after a failure, the next call with correct details succeeds:
    ```ts
    const signInPlayer = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce({ ok: true });
    await handleSignIn({ ...nav(), signInPlayer }, "a@b.co", "bad-bad-bad");
    expect(await handleSignIn({ ...nav(), signInPlayer }, "a@b.co", "play-2026")).toEqual({});
    ```
  - |
    AC5 (Playwright, player-accounts.spec.ts) - fail once via the stubbed route, then succeed, and the message is gone:
    ```ts
    await expect(page.getByText("Email or password is incorrect")).toBeVisible();
    await page.getByLabel("Password").fill("play-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect")).toHaveCount(0);
    ```
  - |
    AC6 (vitest markup, existing test kept) - link to create an account:
    ```ts
    const html = renderToStaticMarkup(<SignInForm />);
    expect(html).toContain('href="/register"');
    expect(html).toContain("Create an account");
    ```
  - |
    AC7 (API unit, services/api/src/players/players.service.spec.ts or the existing session spec; check the file for an existing authenticate test first) - registered as Player@Example.com, authenticate with padded lower-case email returns the player:
    ```ts
    expect(normaliseEmail(" player@example.com ")).toBe("player@example.com");
    expect(await players.authenticate(" player@example.com ", "play-2026")).toMatchObject({ email: "player@example.com" });
    ```
    plus a web test that handleSignIn passes the email through to signInPlayer without rejecting the padding.
  - |
    AC8 (vitest, plus credentials.test.ts for the validator) - empty or whitespace email shows the required message and makes no API call:
    ```ts
    const deps = { ...nav(), signInPlayer: vi.fn() };
    expect(await handleSignIn(deps, "  ", "play-2026")).toEqual({ email: "Enter your email" });
    expect(deps.signInPlayer).not.toHaveBeenCalled();
    ```
    Markup/e2e: `await expect(page.getByText("Enter your email")).toBeVisible();`
  - |
    AC9 (vitest) - empty password shows the required message beside the password field:
    ```ts
    expect(await handleSignIn(deps, "a@b.co", "")).toEqual({ password: "Enter your password" });
    expect(deps.signInPlayer).not.toHaveBeenCalled();
    ```
    Markup/e2e: `await expect(page.getByText("Enter your password")).toBeVisible();`
assumptions_or_open_questions:
  - |
    Required-message copy ("Enter your email", "Enter your password") is not specified by the item; it follows the guidelines' plain, no-blame voice. Reviewer to confirm.
  - |
    Decided by the reviewer: the API response ("Email or password incorrect") is unchanged and the UI shows the sketch's "Email or password is incorrect" for any 401. The UI is therefore coupled to status 401 meaning bad credentials (the API's only 401 on this route).
  - |
    Decided by the reviewer: the sketch's link label "Create an account" is kept. AC6 says "Create account"; treat the AC as satisfied by the sketch's label and update the AC wording on the work item for consistency (a human edit, not part of the code).
  - |
    Decided by the reviewer: logging and monitoring of sign-in attempts, and the other deferred questions (password storage, environments, data retention), go to a separate security/operational decision and do not block this story. No code for them here.
  - |
    Decided by the reviewer: post-sign-in redirect is unchanged. Verified in apps/web/src/app/sign-in/page.tsx and signInTarget in apps/web/src/lib/shell.ts: a known `next` value is allow-listed, otherwise /wallet. The sketch's sign-in-done exit to the lobby is deliberately not followed in this story.
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout
  None — web UI and client-side validation only; no schema, stored data, seed or settings change, and the Records API is untouched. Safe to roll back by reverting the commit.

  Design tokens: no new styling. SignInForm keeps the existing design-system classes (.card, .field, .input, .is-invalid, .field-error, .btn-primary, .alert-info, .link), which already resolve to the project's tokens (color-danger for errors, space-* for rhythm). I did not open design-system/ or the web app's token loading since no new token or stylesheet work is planned; if the reviewer wants that confirmed, it is a quick check before implementation.

  Reused components: SignInForm (extended), RegisterForm (pattern only). The existing TopBar and TopBarControls are not touched.

  ```mermaid
  flowchart TD
    Page[app/sign-in/page.tsx] --> Form[SignInForm.tsx]
    Form --> Cred[lib/credentials.ts]
    Form --> Sess[lib/session.ts signInPlayer]
    Sess --> Ctl[API session.controller.ts]
    Ctl --> Svc[players.service.ts authenticate]
    Reg[RegisterForm.tsx] -. pattern mirrored .-> Form
    classDef touched fill:#f96,color:#000
    class Form,Cred touched
  ```
  Form is touched to return field errors, Cred to add required checks; the rest is verified by tests only.
review_focus: |
  IN: inline required messages (AC8/9) and moving the failed message beside the password field per the sketch; everything else is regression tests over behaviour that already works (API trims and lower-cases email, one 401 for unknown email and wrong password). OUT: password reset, lockout, any API change (the API's 401 body stays "Email or password incorrect"; the UI maps 401 to the sketch's "is incorrect" text on purpose), redirect changes (existing next-or-/wallet behaviour kept), and sign-in logging/monitoring (deferred). Riskiest bit is changing handleSignIn's return type from `string | null` to an errors object, since existing tests and any other caller must be updated, and making sure sign-in does not apply register's format or length rules. The unknown-email and wrong-password messages must stay identical to avoid account enumeration.
