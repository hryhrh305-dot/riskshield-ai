import { createClient } from "@/lib/supabase";
import { buildAuthRedirectUrl } from "@/lib/auth-helpers";

export async function signUp(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildAuthRedirectUrl(process.env, "/dashboard"),
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/";
}

export async function requestPasswordReset(email: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildAuthRedirectUrl(process.env, "/reset-password"),
  });
  return { data, error };
}

export async function updatePassword(password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  return { data, error };
}

export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
