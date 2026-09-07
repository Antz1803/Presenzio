import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { AuthContext } from "./context";
import { storeInstructorAvatar } from "./profileStorage";

function configurationError() {
  return new Error("Authentication is not configured. Add the Supabase environment variables first.");
}

function instructorMetadata(profile = {}) {
  const safeProfile = {
    name: String(profile.name || "").trim(),
    position: String(profile.position || "").trim(),
    gmail: String(profile.gmail || "").trim(),
    facebook: String(profile.facebook || "").trim(),
    courses: Array.isArray(profile.courses) ? profile.courses : [],
    initials: String(profile.initials || "").trim(),
    color: profile.color || "plum",
  };

  return Object.fromEntries(
    Object.entries(safeProfile).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    }),
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return undefined;

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error("Could not restore the authentication session:", error);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    configured: isSupabaseConfigured,
    async login(email, password) {
      if (!supabase) throw configurationError();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.user;
    },
    async register(name, email, password) {
      if (!supabase) throw configurationError();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) throw error;
      return data;
    },
    async updateProfile({ name, email, password }) {
      if (!supabase) throw configurationError();

      const normalizedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const emailChanged = normalizedEmail !== (user?.email || "").toLowerCase();
      const currentInstructorProfile = instructorMetadata(
        user?.user_metadata?.instructor_profile,
      );
      const { data, error } = await supabase.auth.updateUser({
        ...(emailChanged ? { email: normalizedEmail } : {}),
        ...(password ? { password } : {}),
        data: {
          full_name: normalizedName,
          ...(Object.keys(currentInstructorProfile).length
            ? { instructor_profile: { ...currentInstructorProfile, name: normalizedName } }
            : {}),
        },
      });

      if (error) throw error;
      if (data.user) setUser(data.user);

      return {
        user: data.user,
        emailChangeRequested: emailChanged,
      };
    },
    async updateInstructorProfile(profile) {
      if (!supabase) throw configurationError();

      const normalizedProfile = {
        name: profile.name.trim(),
        position: profile.position.trim(),
        gmail: profile.gmail.trim(),
        facebook: profile.facebook.trim(),
        courses: Array.isArray(profile.courses) ? profile.courses : [],
        initials: profile.initials.trim(),
        color: profile.color,
        avatarUrl: profile.avatarUrl || "",
      };
      const metadataProfile = instructorMetadata(normalizedProfile);
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: normalizedProfile.name,
          instructor_profile: metadataProfile,
        },
      });

      if (error) throw error;
      storeInstructorAvatar(user?.id, normalizedProfile.avatarUrl);
      if (data.user) setUser(data.user);
      return normalizedProfile;
    },
    async logout() {
      if (!supabase) {
        setUser(null);
        return;
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
