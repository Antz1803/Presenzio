import { useState } from "react";
import { StudentPhotoPicker } from "./StudentPhotoPicker";

const LABEL =
  "flex flex-col gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3";
const INPUT =
  "w-full rounded-lg border border-ink-3/30 bg-surface-1 px-3 py-2.5 font-sans text-sm normal-case tracking-normal text-ink placeholder:text-ink-3 transition hover:border-accent/30 focus:border-accent focus:shadow-focus focus:outline-none";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50";

function SectionTitle({ children }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        {children}
      </h3>
      <span className="h-px flex-1 bg-white/5" />
    </div>
  );
}

function AddStudentForm({ onSave, onClose }) {
  const [form, setForm] = useState({
    student_no: "",
    full_name: "",
    gender: "",
    course: "",
    year_level: "",
    photo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={save}>
      <div className="grid gap-6 md:grid-cols-[1fr_200px]">
        {/* Details */}
        <section>
          <SectionTitle>Student details</SectionTitle>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <label className={LABEL}>
              Student ID
              <input
                className={INPUT}
                name="studentNumber"
                placeholder="e.g. 2517141"
                required
                value={form.student_no}
                onChange={(event) => update("student_no", event.target.value)}
              />
            </label>
            <label className={LABEL}>
              Gender
              <select
                className={INPUT}
                name="studentGender"
                value={form.gender}
                onChange={(event) => update("gender", event.target.value)}
              >
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </label>
            <label className={`${LABEL} col-span-2 max-sm:col-span-1`}>
              Full name
              <input
                className={INPUT}
                name="studentFullName"
                placeholder="LASTNAME, FIRSTNAME M."
                required
                value={form.full_name}
                onChange={(event) => update("full_name", event.target.value)}
              />
            </label>
            <label className={LABEL}>
              Course
              <input
                className={INPUT}
                name="studentCourse"
                placeholder="e.g. BSIT"
                value={form.course}
                onChange={(event) => update("course", event.target.value)}
              />
            </label>
            <label className={LABEL}>
              Year level
              <input
                className={INPUT}
                name="studentYearLevel"
                placeholder="e.g. 2nd"
                value={form.year_level}
                onChange={(event) => update("year_level", event.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Photo */}
        <section className="md:border-l md:border-white/5 md:pl-6">
          <SectionTitle>Photo</SectionTitle>
          <StudentPhotoPicker
            value={form.photo_url}
            onChange={(photo) => update("photo_url", photo)}
            disabled={saving}
          />
        </section>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4 max-sm:[&_button]:flex-1">
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>
          Cancel
        </button>
        <button className={BTN_PRIMARY} disabled={saving}>
          {saving ? "Saving…" : "Add student"}
        </button>
      </div>
    </form>
  );
}

export { AddStudentForm };
