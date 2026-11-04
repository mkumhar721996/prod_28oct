export const ORG_SESSION_COOKIE = 'app_session';
/** A session is refused after this long without a request (assumed: the story gives no figure). */
export const ORG_IDLE_MS = 30 * 60 * 1000;
/** One message for every sign-in failure, so it never says which part was wrong. */
export const ORG_SIGN_IN_REFUSAL = 'Email or password is incorrect';
