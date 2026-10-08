import { useState } from "react";
import { useAuth } from "./useAuth";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm print:hidden"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !saving && onClose()
      }
    >
      <section
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-details-title"
      >
        <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              Account Settings
            </p>
            <h2
              id="profile-details-title"
              className="mt-1 text-lg font-bold text-slate-900"
            >
              Edit Profile Details
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Update your teacher account information.
            </p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close profile details"
          >
            ×
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-xs font-bold text-slate-600">
            Full name
            <input
              className={inputClass}
              type="text"
              name="fullName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              disabled={saving}
              required
            />
          </label>

          <label className="block text-xs font-bold text-slate-600">
            Email address
            <input
              className={inputClass}
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={saving}
              required
            />
            <span className="mt-1.5 block text-[11px] font-normal text-slate-400">
              Changing your email sends a verification link to the new address.
              The change applies after you click it.
            </span>
          </label>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-600">Printing logos</p>
            <p className="mt-1 text-[11px] font-normal text-slate-400">
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
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-white p-2">
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
                  <p className="text-[11px] font-bold text-slate-600">{logo.label}</p>
                  <input
                    className="mt-2 block w-full text-[11px] text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-100 file:px-2.5 file:py-1.5 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-200"
                    type="file"
                    accept="image/png"
                    onChange={(event) =>
                      handleLogoUpload(event, logo.setValue, logo.label)
                    }
                    disabled={saving}
                  />
                  {logo.value && (
                    <button
                      className="mt-2 text-[11px] font-semibold text-rose-600 hover:text-rose-700"
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

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-600">Change password</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Leave these fields blank to keep your current password.
            </p>
          </div>

          <label className="block text-xs font-bold text-slate-600">
            Current password
            <input
              className={inputClass}
              type="password"
              name="currentPassword"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={saving}
            />
            <span className="mt-1.5 block text-[11px] font-normal text-slate-400">
              Required only when changing your email or password.
            </span>
          </label>

          <label className="block text-xs font-bold text-slate-600">
            New password
            <input
              className={inputClass}
              type="password"
              name="newPassword"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={saving}
              minLength={6}
            />
          </label>

          <label className="block text-xs font-bold text-slate-600">
            Confirm new password
            <input
              className={inputClass}
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={saving}
              minLength={6}
            />
          </label>

          {error && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-600">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700">
              {notice}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
