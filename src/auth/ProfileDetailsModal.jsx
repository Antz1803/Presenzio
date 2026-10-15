import { useState } from "react";
import { useAuth } from "./useAuth";
import { Icon } from "../MVVM/Views/DashboardShared";

const FOCUS = "focus-visible:outline-accent!";
const INPUT =
  "w-full rounded border border-ink-3/30 bg-surface-1 px-3 py-2.5 font-sans! text-sm font-normal normal-case tracking-normal text-ink placeholder:text-ink-3 transition focus:border-accent focus:shadow-focus focus:outline-none disabled:opacity-50";
const LABEL =
  "flex flex-col gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3";
const HINT = "font-sans text-[11px] font-normal normal-case tracking-normal text-ink-3";
const SECTION_TITLE = "font-display text-sm font-semibold tracking-tight text-ink";
const BTN_PRIMARY = `inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_GHOST = `inline-flex items-center justify-center gap-2 rounded border border-white/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-ink-2 transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export default function ProfileDetailsModal({ onClose }) {
  const { user, updateProfile, updateInstructorProfile } = useAuth();
  const instructorProfile = user?.user_metadata?.instructor_profile || {};
  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [printLogoLeftUrl, setPrintLogoLeftUrl] = useState(
    instructorProfile.printLogoLeftUrl || "",
  );
  const [printLogoRightUrl, setPrintLogoRightUrl] = useState(
    instructorProfile.printLogoRightUrl || "",
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLogoUpload = (event, setLogo, side) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      setError(`${side} logo must be a PNG file.`);
      return;
    }
    if (file.size > 1_500_000) {
      setError(`${side} logo must be smaller than 1.5 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(String(reader.result || ""));
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password && password.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }

    const emailChanged =
      cleanEmail.toLowerCase() !== (user?.email || "").toLowerCase();
    if ((emailChanged || password) && !currentPassword) {
      setError("Enter your current password to change your email or password.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateProfile({
        name: cleanName,
        email: cleanEmail,
        password,
        currentPassword,
      });

      await updateInstructorProfile({
        ...instructorProfile,
        name: cleanName,
        position: instructorProfile.position || "Instructor",
        gmail: instructorProfile.gmail || "",
        facebook: instructorProfile.facebook || "",
        courses: Array.isArray(instructorProfile.courses)
          ? instructorProfile.courses
          : [],
        initials:
          instructorProfile.initials ||
          cleanName
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        color: instructorProfile.color || "plum",
        avatarUrl: instructorProfile.avatarUrl || "",
        printLogoLeftUrl,
        printLogoRightUrl,
      });

      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setNotice(
        result.emailChangeRequested
          ? "Profile saved. Check your new email address to confirm the email change."
          : "Profile details saved successfully.",
      );
    } catch (saveError) {
      setError(saveError?.message || "Could not save your profile details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-xl print:hidden"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !saving && onClose()
      }
    >
      <section
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-accent/35 border-b-accent-2/20 bg-surface-3 p-6 shadow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-details-title"
      >
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-accent via-sky-600 to-[#0D82FF] text-canvas shadow-lg shadow-accent/30">
              <Icon name="settings" size={20} />
            </span>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                Account settings
              </p>
              <h2
                id="profile-details-title"
                className="font-display text-lg font-semibold tracking-tight text-ink"
              >
                Edit profile details
              </h2>
              <p className="mt-0.5 text-xs text-ink-2">
                Update your teacher account information.
              </p>
            </div>
          </div>
          <button
            className={`grid size-8 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-surface-2 hover:text-accent disabled:opacity-50 ${FOCUS}`}
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close profile details"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Profile */}
          <div className="space-y-4">
            <label className={LABEL}>
              Full name
              <input
                className={INPUT}
                type="text"
                name="fullName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                disabled={saving}
                required
              />
            </label>

            <label className={LABEL}>
              Email address
              <input
                className={INPUT}
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={saving}
                required
              />
              <span className={HINT}>
                Changing your email sends a verification link to the new
                address. The change applies after you click it.
              </span>
            </label>
          </div>

          {/* Printing logos */}
          <div className="border-t border-white/5 pt-5">
            <p className={SECTION_TITLE}>Printing logos</p>
            <p className={`${HINT} mt-1`}>
              Upload PNG logos for the left and right sides of printed reports.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Left logo",
                  value: printLogoLeftUrl,
                  setValue: setPrintLogoLeftUrl,
                },
                {
                  label: "Right logo",
                  value: printLogoRightUrl,
                  setValue: setPrintLogoRightUrl,
                },
              ].map((logo) => (
                <div
                  key={logo.label}
                  className="rounded-lg border border-white/5 bg-surface-1 p-3"
                >
                  {/* Reports print on white paper, so preview logos on white. */}
                  <div className="mb-3 flex h-20 items-center justify-center rounded border border-white/10 bg-white p-2">
                    {logo.value ? (
                      <img
                        src={logo.value}
                        alt={`${logo.label} preview`}
                        className="h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400">Not set</span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-2">
                    {logo.label}
                  </p>
                  <input
                    className="mt-2 block w-full text-[11px] text-ink-3 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-accent/15 file:px-2.5 file:py-1.5 file:font-mono file:text-[11px] file:font-bold file:text-accent hover:file:bg-accent/25"
                    type="file"
                    accept="image/png"
                    aria-label={`Upload ${logo.label.toLowerCase()}`}
                    onChange={(event) =>
                      handleLogoUpload(event, logo.setValue, logo.label)
                    }
                    disabled={saving}
                  />
                  {logo.value && (
                    <button
                      className={`mt-2 rounded text-[11px] font-semibold text-rose-300 transition hover:text-rose-200 ${FOCUS}`}
                      type="button"
                      onClick={() => logo.setValue("")}
                      disabled={saving}
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Password */}
          <div className="space-y-4 border-t border-white/5 pt-5">
            <div>
              <p className={SECTION_TITLE}>Change password</p>
              <p className={`${HINT} mt-1`}>
                Leave these fields blank to keep your current password.
              </p>
            </div>

            <label className={LABEL}>
              Current password
              <input
                className={INPUT}
                type="password"
                name="currentPassword"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={saving}
              />
              <span className={HINT}>
                Required only when changing your email or password.
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={LABEL}>
                New password
                <input
                  className={INPUT}
                  type="password"
                  name="newPassword"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={saving}
                  minLength={6}
                />
              </label>

              <label className={LABEL}>
                Confirm new password
                <input
                  className={INPUT}
                  type="password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={saving}
                  minLength={6}
                />
              </label>
            </div>
          </div>

          {error && (
            <p
              className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-300"
              role="alert"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-300"
              role="status"
            >
              {notice}
            </p>
          )}

          <div className="sticky -bottom-6 -mx-6 -mb-6 flex justify-end gap-3 border-t border-white/5 bg-surface-3/95 px-6 py-4 backdrop-blur">
            <button
              className={BTN_GHOST}
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button className={BTN_PRIMARY} type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
