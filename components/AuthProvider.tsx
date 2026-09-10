"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import FirstPasswordModal from "@/components/FirstPasswordModal";

export type Profile = {
  email: string;
  role: "member" | "admin";
  mustChangePassword: boolean;
};

type AuthState = {
  /** Supabase konfigurert i det hele tatt? */
  enabled: boolean;
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  changePassword: (password: string) => Promise<{ error: string | null }>;
  /** Kalles etter at brukeren har satt eget passord ved førstegangsinnlogging. */
  clearMustChangePassword: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth må brukes innenfor <AuthProvider>");
  return v;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const enabled = supabaseConfigured();
  const [loading, setLoading] = useState(enabled);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const user = session?.user ?? null;

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const { data } = await getSupabase()
        .from("profiles")
        .select("email, role, must_change_password")
        .eq("id", uid)
        .single();
      setProfile(
        data
          ? {
              email: data.email as string,
              role: (data.role as Profile["role"]) ?? "member",
              mustChangePassword: Boolean(data.must_change_password),
            }
          : { email: "", role: "member", mustChangePassword: false },
      );
    } catch {
      setProfile({ email: "", role: "member", mustChangePassword: false });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [enabled, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return { error: error ? "Feil e-post eller passord." : null };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const changePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    return { error: error ? error.message : null };
  }, []);

  const clearMustChangePassword = useCallback(async () => {
    try {
      await getSupabase().rpc("mark_password_changed");
    } catch {
      /* ignorér – flagget prøves igjen ved neste innlogging */
    }
    setProfile((p) => (p ? { ...p, mustChangePassword: false } : p));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      enabled,
      loading,
      user,
      profile,
      accessToken: session?.access_token ?? null,
      signIn,
      signOut,
      changePassword,
      clearMustChangePassword,
    }),
    [
      enabled,
      loading,
      user,
      profile,
      session,
      signIn,
      signOut,
      changePassword,
      clearMustChangePassword,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <FirstPasswordModal />
    </Ctx.Provider>
  );
}
