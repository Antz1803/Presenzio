import { useEffect, useMemo, useState } from "react";
import { Icon } from "../DashboardShared";
import { formatClassTime, getLiveClassInfo } from "./overviewUtils";

function InfoBlock({ label, children }) {
  return (
    <div className="bg-slate-50/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-100/80 shadow-inner">
      <span className="text-slate-400 font-medium block text-[10px] uppercase tracking-wider mb-1">{label}</span>
      {children}
    </div>
  );
}

function getInitials(name) {
  return String(name || "Teacher")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ExpandedInstructorProfileCard({ instructor, onUpdateInstructor, sections }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [, setLiveClassTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLiveClassTick((tick) => tick + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const liveClass = getLiveClassInfo(sections);

  const defaultProfile = useMemo(() => ({
    name: instructor?.name || "Teacher",
    position: instructor?.position || "Instructor",
    gmail: instructor?.gmail || "",
    facebook: instructor?.facebook || "",
    courses: Array.isArray(instructor?.courses) ? instructor.courses : [],
    initials: instructor?.initials || getInitials(instructor?.name),
    color: instructor?.color || "bg-gradient-to-br from-indigo-500 to-violet-600",
    avatarUrl: instructor?.avatarUrl || "",
  }), [instructor]);

  const [formData, setFormData] = useState(defaultProfile);
  // Store raw text for comma-separated courses editing
  const [coursesInput, setCoursesInput] = useState("");

  const visibleProfile = isEditing ? formData : defaultProfile;

  const handleOpenEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFormData(defaultProfile);
    setSaveError("");
    // Convert array to comma-separated string for editing
    setCoursesInput(Array.isArray(defaultProfile.courses) ? defaultProfile.courses.join(", ") : defaultProfile.courses || "");
    setIsEditing(true);
  };

  const handleChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleCoursesChange = (e) => {
    setCoursesInput(e.target.value);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxSize = 512;
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          setFormData((p) => ({ ...p, avatarUrl: canvas.toDataURL("image/jpeg", 0.82) }));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSaveError("");

    // Parse comma-separated string back to array
    const updatedCourses = coursesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const updatedProfile = {
      ...formData,
      name: formData.name.trim(),
      position: formData.position.trim(),
      gmail: formData.gmail.trim(),
      facebook: formData.facebook.trim(),
      courses: updatedCourses,
      initials: getInitials(formData.name),
    };

    if (!updatedProfile.name) {
      setSaveError("Full name is required.");
      return;
    }

    setSaving(true);
    try {
      await onUpdateInstructor?.(updatedProfile);
      setFormData(updatedProfile);
      setIsEditing(false);
    } catch (error) {
      setSaveError(error?.message || "Could not save the profile details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 relative">
        <button
          type="button"
          onClick={handleOpenEdit}
          className="absolute top-5 right-5 p-2.5 bg-slate-100/80 hover:bg-slate-200/80 rounded-2xl text-slate-600 transition-all border border-slate-200/50 backdrop-blur-md shadow-sm z-10"
          title="Edit Profile Settings"
        >
          <Icon name="settings" size={16} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <div className="md:col-span-7 flex flex-col justify-between space-y-3">
            <div className="space-y-2.5 text-xs">
              <InfoBlock label="Live Schedule">
                {liveClass ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg border border-emerald-200/50">
                        {liveClass.code}
                      </span>
                      {liveClass.name && <span className="text-slate-600 font-medium text-xs truncate">{liveClass.name}</span>}
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-200">
                        Ongoing
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                      <span className="bg-slate-200/60 font-medium text-slate-700 px-2 py-0.5 rounded-md">Sec. {liveClass.sec}</span>
                      <span className="bg-indigo-50 font-medium text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100/50">Room: {liveClass.room}</span>
                      <span className="self-center">{formatClassTime(liveClass.timeStart)} - {formatClassTime(liveClass.timeEnd)}</span>
                    </div>
                  </div>
                ) : (
                  <span className="font-semibold text-slate-400">No class in session</span>
                )}
              </InfoBlock>

              <InfoBlock label="Gmail Account">
                <a href={`mailto:${visibleProfile.gmail}`} className="font-semibold text-indigo-600 hover:underline truncate block">{visibleProfile.gmail || "Not set"}</a>
              </InfoBlock>

              <InfoBlock label="Facebook Profile">
                {visibleProfile.facebook ? (
                  <a href={visibleProfile.facebook.startsWith("http") ? visibleProfile.facebook : `https://${visibleProfile.facebook}`} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:underline truncate block">
                    {visibleProfile.facebook}
                  </a>
                ) : (
                  <span className="font-semibold text-slate-400">Not set</span>
                )}
              </InfoBlock>

              <InfoBlock label="Courses Handled">
                <div className="flex flex-wrap gap-1.5">
                  {(visibleProfile.courses || []).map((course, idx) => (
                    <span key={`${course}-${idx}`} className="bg-indigo-50/80 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-lg text-[11px] border border-indigo-100/50">
                      {course}
                    </span>
                  ))}
                </div>
              </InfoBlock>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col items-center justify-between">
            <div className="w-full h-full min-h-[180px] max-h-[260px] bg-slate-100/80 rounded-2xl overflow-hidden border border-slate-200/60 shadow-inner flex items-center justify-center relative group">
              {visibleProfile.avatarUrl ? (
                <img src={visibleProfile.avatarUrl} alt={visibleProfile.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className={`w-full h-full ${visibleProfile.color} flex items-center justify-center text-white text-5xl font-black bg-gradient-to-br from-indigo-500 to-violet-600`}>
                  {visibleProfile.initials}
                </div>
              )}
            </div>

            <div className="text-center pt-3 w-full">
              <h2 className="text-lg font-black text-slate-900 leading-tight">{visibleProfile.name}</h2>
              <p className="text-xs font-bold text-indigo-600 mt-0.5">{visibleProfile.position}</p>
            </div>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/60 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Edit Profile Details</h3>
              <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">×</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Upload Profile Photo</label>
                <input name="profilePhoto" type="file" accept="image/*" onChange={handleImageUpload} disabled={saving} className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required disabled={saving} className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Position / Title</label>
                <input type="text" name="position" value={formData.position} onChange={handleChange} disabled={saving} className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Courses Handled (comma-separated)</label>
                <input 
                  type="text" 
                  name="courses" 
                  value={coursesInput} 
                  onChange={handleCoursesChange} 
                  placeholder="e.g. BSIT 3A - Web Dev, BSCS 2B - OOP" 
                  disabled={saving}
                  className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50" 
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Gmail Address</label>
                <input type="email" name="gmail" value={formData.gmail} onChange={handleChange} disabled={saving} className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Facebook URL</label>
                <input type="text" name="facebook" value={formData.facebook} onChange={handleChange} disabled={saving} className="w-full p-2.5 rounded-xl border border-slate-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50" />
              </div>

              {saveError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{saveError}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => !saving && setIsEditing(false)} disabled={saving} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:opacity-90 shadow-md shadow-indigo-200 disabled:opacity-60">{saving ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
