/**
 * Auth — sessions, sign-in/out, role resolution.
 *
 * The permission model itself lives in the database (supabase/migrations/0011_rls.sql).
 * Everything here is convenience on top of it.
 */
export {
  getSession,
  requireSession,
  requireRole,
  homePathForRole,
  type Session,
} from "./session";
export { signIn, signUp, signOut, type AuthFormState } from "./actions";
