import { useState } from "react";
function AddStudentForm({ onSave, onClose }) {
  const [form, setForm] = useState({
    student_no: "",
    full_name: "",
    gender: "",
    course: "",
    year_level: "",
  });
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm({ ...form, [key]: value });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };
  return (
    <form onSubmit={save}>
      <div className="action-form-grid">
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
      </div>
      <div className="action-modal-footer">
        <button type="button" className="outline-button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" disabled={saving}>
          {saving ? "Saving…" : "Add student"}
        </button>
      </div>
    </form>
  );
}

export { AddStudentForm };
