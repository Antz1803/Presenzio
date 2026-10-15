import { useState } from "react";
import { StudentPhotoPicker } from "./StudentPhotoPicker";
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
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };
  return (
    <form onSubmit={save}>
      <div className="grid grid-cols-[repeat(2,1fr)] gap-3 [&.single]:grid-cols-[1fr] [&_label]:flex [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-ink-2 [&_label]:text-[10px] [&_label]:font-semibold [&_input]:w-full [&_input]:box-border [&_input]:border [&_input]:border-white/10 [&_input]:rounded-[7px] [&_input]:bg-surface-1 [&_input]:text-ink-2 [&_input]:p-[9px] [&_input]:text-[11px] [&_input]:outline-none [&_select]:w-full [&_select]:box-border [&_select]:border [&_select]:border-white/10 [&_select]:rounded-[7px] [&_select]:bg-surface-1 [&_select]:text-ink-2 [&_select]:p-[9px] [&_select]:text-[11px] [&_select]:outline-none [&_input:focus]:border-accent/30 [&_input:focus]:[box-shadow:0_0_0_3px_#162032] [&_select:focus]:border-accent/30 [&_select:focus]:[box-shadow:0_0_0_3px_#162032] max-[760px]:grid-cols-[repeat(2,1fr)] [.action-modal_&_label]:text-ink-2 [.action-modal_&_label]:text-[10px] [.action-modal_&_label]:tracking-[.1px] [.action-modal_&_input]:border-white/10 [.action-modal_&_input]:rounded-[9px] [.action-modal_&_input]:bg-surface-1 [.action-modal_&_input]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_input]:transition [.action-modal_&_select]:border-white/10 [.action-modal_&_select]:rounded-[9px] [.action-modal_&_select]:bg-surface-1 [.action-modal_&_select]:[box-shadow:0_2px_5px_rgba(0,240,255,0.01)] [.action-modal_&_select]:transition [.action-modal_&_input:hover]:border-accent/30 [.action-modal_&_select:hover]:border-accent/30 [.action-modal_&_input:focus]:border-accent/30 [.action-modal_&_input:focus]:[box-shadow:0_0_0_3px_#162032] [.action-modal_&_select:focus]:border-accent/30 [.action-modal_&_select:focus]:[box-shadow:0_0_0_3px_#162032]">
        <label>
          Student ID
          <input
            name="studentNumber"
            required
            value={form.student_no}
            onChange={(event) => update("student_no", event.target.value)}
          />
        </label>
        <label>
          Full name
          <input
            name="studentFullName"
            required
            value={form.full_name}
            onChange={(event) => update("full_name", event.target.value)}
          />
        </label>
        <label>
          Gender
          <select
            name="studentGender"
            value={form.gender}
            onChange={(event) => update("gender", event.target.value)}
          >
            <option value="">Select</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </label>
        <label>
          Course
          <input
            name="studentCourse"
            value={form.course}
            onChange={(event) => update("course", event.target.value)}
          />
        </label>
        <label>
          Year level
          <input
            name="studentYearLevel"
            value={form.year_level}
            onChange={(event) => update("year_level", event.target.value)}
          />
        </label>
        <label>
          Student photo
          <StudentPhotoPicker
            value={form.photo_url}
            onChange={(photo) => update("photo_url", photo)}
            disabled={saving}
          />
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-5.5 pt-[17px] border-t border-white/10 max-[760px]:flex-wrap max-[760px]:[&_button]:flex-1 [.assessment-builder_&]:mt-0.5">
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded border border-accent/40 bg-transparent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50" onClick={onClose}>
          Cancel
        </button>
        <button className="inline-flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" disabled={saving}>
          {saving ? "Saving…" : "Add student"}
        </button>
      </div>
    </form>
  );
}

export { AddStudentForm };
