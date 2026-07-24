import { Redirect } from "expo-router";

/**
 * Landing route for the "Open SweetMate" link on the hosted email-confirmation
 * page. The website has already verified the email with Supabase, so there is
 * no token to exchange here. AuthGate will either restore an existing session
 * or show sign-in, where the newly confirmed account can log in.
 */
export default function AuthCallbackScreen() {
  return <Redirect href="/" />;
}
