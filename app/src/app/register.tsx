import { Redirect } from 'expo-router';

/** Accounts are created on first OTP verify — no separate register form. */
export default function RegisterScreen() {
  return <Redirect href="/login" />;
}
