import { useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile as updateAuthProfile,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { get, ref, set, update } from "firebase/database";
import { auth, db, isFirebaseConfigured } from "../lib/Firebase";
import { AuthContext } from "./context";

function configurationError() {
  return new Error(
    "Authentication is not configured. Add the Firebase environment variables first.",
  );
}

const AUTH_MESSAGES = {
  "auth/configuration-not-found":
    "Firebase Authentication is not configured for this project. Enable Email/Password sign-in in the Firebase Console.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Your password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/requires-recent-login": "Please enter your current password to confirm this change.",
  "auth/missing-password": "Please enter your password.",
};

function friendlyError(error) {
  const message = AUTH_MESSAGES[error?.code];
  if (!message) return error;
  const friendly = new Error(message);
  friendly.code = error.code;
  return friendly;
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
    avatarUrl: String(profile.avatarUrl || "").trim(),
  };

  return Object.fromEntries(
    Object.entries(safeProfile).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    }),
  );
}

// Presents a Firebase user in the same shape the rest of the app already expects.
function toAppUser(firebaseUser, instructorProfile, access = {}) {
  if (!firebaseUser) return null;
  const hasProfile = instructorProfile && Object.keys(instructorProfile).length > 0;
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    isAdmin: access.isAdmin === true,
    approvalStatus: access.isAdmin ? "approved" : access.request?.status || "pending",
    user_metadata: {
      full_name: firebaseUser.displayName || "",
      ...(hasProfile ? { instructor_profile: instructorProfile } : {}),
    },
  };
}

async function loadInstructorProfile(uid) {
  if (!db) return null;
  try {
    const snap = await get(ref(db, `instructors/${uid}/profile`));
    return snap.exists() ? snap.val() : null;
  } catch (error) {
    // Rules may not allow this yet; the app should still sign in.
    console.warn("Could not load the instructor profile:", error?.code || error);
    return null;
  }
}

async function loadApprovalAccess(uid) {
  if (!db) return { request: null, isAdmin: false };
  const [requestSnapshot, adminSnapshot] = await Promise.all([
    get(ref(db, `registrationRequests/${uid}`)),
    get(ref(db, `admins/${uid}`)),
  ]);
  return {
    request: requestSnapshot.exists() ? requestSnapshot.val() : null,
    isAdmin: adminSnapshot.val() === true,
  };
}

function approvalError(status) {
  if (status === "pending") {
    return new Error("Your teacher account is waiting for administrator approval.");
  }
  if (status === "rejected") {
    return new Error("Your teacher registration was rejected. Contact the administrator.");
  }
  return new Error("Your account does not have an approval request yet.");
}

async function reauthenticate(firebaseUser, currentPassword) {
  if (!currentPassword) return;
  const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
  await reauthenticateWithCredential(firebaseUser, credential);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!auth) return undefined;

    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          if (mounted) setUser(null);
          return;
        }
        const access = await loadApprovalAccess(firebaseUser.uid);
        const allowed =
          access.isAdmin ||
          (access.request?.status === "approved" && access.request?.active !== false);
        const profile = allowed ? await loadInstructorProfile(firebaseUser.uid) : null;
        if (mounted) {
          setUser(allowed ? toAppUser(firebaseUser, profile, access) : null);
        }
      } catch (error) {
        console.error("Could not restore the authentication session:", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,

      async login(email, password) {
        if (!auth) throw configurationError();
        try {
          const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
          const access = await loadApprovalAccess(credential.user.uid);
          if (
            !access.isAdmin &&
            (access.request?.status !== "approved" || access.request?.active === false)
          ) {
            await signOut(auth);
            throw approvalError(access.request?.status);
          }
          return toAppUser(
            credential.user,
            await loadInstructorProfile(credential.user.uid),
            access,
          );
        } catch (error) {
          throw friendlyError(error);
        }
      },

      async register(name, email, password) {
        if (!auth) throw configurationError();
        try {
          const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
          const normalizedName = name.trim();
          const normalizedEmail = email.trim().toLowerCase();
          await updateAuthProfile(credential.user, { displayName: normalizedName });
          await set(ref(db, `registrationRequests/${credential.user.uid}`), {
            uid: credential.user.uid,
            name: normalizedName,
            email: normalizedEmail,
            status: "pending",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          await signOut(auth);
          setUser(null);
          return { user: null, session: null, pendingApproval: true };
        } catch (error) {
          throw friendlyError(error);
        }
      },

      async updateProfile({ name, email, password, currentPassword }) {
        if (!auth?.currentUser) throw configurationError();
        const firebaseUser = auth.currentUser;

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();
        const emailChanged = normalizedEmail !== (user?.email || "").toLowerCase();

        try {
          if (emailChanged || password) {
            await reauthenticate(firebaseUser, currentPassword);
          }
          if (emailChanged) {
            // Sends a verification link; the address changes after the link is clicked.
            await verifyBeforeUpdateEmail(firebaseUser, normalizedEmail);
          }
          if (password) {
            await updatePassword(firebaseUser, password);
          }
          if (normalizedName !== (firebaseUser.displayName || "")) {
            await updateAuthProfile(firebaseUser, { displayName: normalizedName });
          }
          if (user?.user_metadata?.instructor_profile) {
            await update(ref(db, `instructors/${firebaseUser.uid}/profile`), {
              name: normalizedName,
            });
          }
        } catch (error) {
          throw friendlyError(error);
        }

        const profile = user?.user_metadata?.instructor_profile
          ? { ...user.user_metadata.instructor_profile, name: normalizedName }
          : null;
        const nextUser = toAppUser(auth.currentUser, profile, {
          isAdmin: user?.isAdmin,
          request: { status: user?.approvalStatus },
        });
        setUser(nextUser);

        return { user: nextUser, emailChangeRequested: emailChanged };
      },

      async updateInstructorProfile(profile) {
        if (!auth?.currentUser) throw configurationError();
        const firebaseUser = auth.currentUser;

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

        try {
          // set() with an empty object would delete the node, which is what we want
          // if every field was cleared.
          await set(ref(db, `instructors/${firebaseUser.uid}/profile`), metadataProfile);
          await updateAuthProfile(firebaseUser, { displayName: normalizedProfile.name });
        } catch (error) {
          throw friendlyError(error);
        }

        setUser(toAppUser(auth.currentUser, metadataProfile));
        return normalizedProfile;
      },

      async logout() {
        if (!auth) {
          setUser(null);
          return;
        }
        await signOut(auth);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
