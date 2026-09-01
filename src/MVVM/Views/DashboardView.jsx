import React, { useState } from "react";

// --- Sub-Components & Icons ---

export function Icon({ name, size = 18, className = "" }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.41 1.41-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2v-.49a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.41-1.41.06-.06A1.7 1.7 0 0 0 9.44 15a1.7 1.7 0 0 0-1.56-1.03H7v-2h.88A1.7 1.7 0 0 0 9.44 11a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.41-1.41.06.06A1.7 1.7 0 0 0 12.33 8a1.7 1.7 0 0 0 1.09-1.5V6h2v.5A1.7 1.7 0 0 0 16.45 8a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.41 1.41-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.96 12H21v2h-.04A1.7 1.7 0 0 0 19.4 15z" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></>,
    edit: <><path d="m4 16.5-.8 3.3 3.3-.8L19.8 5.7a2.3 2.3 0 0 0-3.3-3.3z" /><path d="m14.8 3.8 3.3 3.3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    sparkles: <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name] || paths.grid}
    </svg>
  );
}

export function Avatar({ initials, small = false }) {
  return (
    <div className={`relative inline-flex items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 p-[2px] shadow-lg shadow-indigo-500/20 ${small ? "w-9 h-9" : "w-11 h-11"}`}>
      <span className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center text-white font-bold text-xs tracking-wider">
        {initials || "JM"}
      </span>
    </div>
  );
}


function EditableClassRow({ item, index, isSelected, isEditing, onStartEdit, onCancelEdit, onSave, onOpenClassOptions, onOpenStudents, onDeleteClass }) {
  const [draft, setDraft] = useState(() => ({
    days: item.days || "",
    time_start: item.time_start || "",
    time_end: item.time_end || "",
    edp_code: item.edp_code || "",
    subject_code: item.subject_code || "",
    subject_title: item.subject_title || "",
    room: item.room || "",
    year_level: item.year_level || "",
    section_no: item.section_no || "",
  }));
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setDraft((curr) => ({ ...curr, [key]: value }));

  const colorGradients = [
    "from-indigo-500 to-purple-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-orange-500",
    "from-pink-500 to-rose-500",
    "from-cyan-400 to-blue-500",
  ];
  const activeGradient = colorGradients[index % colorGradients.length];

  if (isEditing) {
    return (
      <tr className="bg-indigo-950/40 backdrop-blur-md border-y border-indigo-500/30 text-slate-200 transition-all">
        <td className="p-4">
          <input className="w-full px-3 py-1.5 text-xs bg-slate-900/80 border border-indigo-500/40 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value={draft.days} placeholder="TTh" onChange={(e) => update("days", e.target.value)} />
        </td>
        <td className="p-4">
          <div className="flex items-center gap-1">
            <input type="time" className="w-full px-2 py-1 text-xs bg-slate-900/80 border border-indigo-500/40 rounded-lg text-white" value={draft.time_start} onChange={(e) => update("time_start", e.target.value)} />
            <span className="text-slate-500">-</span>
            <input type="time" className="w-full px-2 py-1 text-xs bg-slate-900/80 border border-indigo-500/40 rounded-lg text-white" value={draft.time_end} onChange={(e) => update("time_end", e.target.value)} />
          </div>
        </td>
        {["edp_code", "subject_code", "subject_title", "room", "year_level", "section_no"].map((f) => (
          <td key={f} className="p-4">
            <input className="w-full px-3 py-1.5 text-xs bg-slate-900/80 border border-indigo-500/40 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value={draft[f]} onChange={(e) => update(f, e.target.value)} />
          </td>
        ))}
        <td className="p-4">
          <div className="flex items-center gap-2">
            <button onClick={() => onSave(item.id, draft)} disabled={saving} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-600/30 transition-all">
              <Icon name="check" size={16} />
            </button>
            <button onClick={onCancelEdit} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg">×</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`group border-b border-slate-800/60 hover:bg-slate-800/40 transition-all duration-200 ${isSelected ? "bg-indigo-950/30" : ""}`}>
      <td className="p-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-800 text-indigo-300 border border-indigo-500/20 shadow-inner">
          <Icon name="clock" size={12} className="text-indigo-400" /> {item.days || "—"}
        </span>
      </td>
      <td className="p-4 text-xs font-medium text-slate-400">{item.time_start && item.time_end ? `${item.time_start} - ${item.time_end}` : "—"}</td>
      <td className="p-4 text-xs font-mono text-slate-400">{item.edp_code || "—"}</td>
      <td className="p-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${activeGradient} shadow-md shadow-indigo-500/50`} />
          <span className="text-sm font-bold text-white tracking-wide">{item.subject_code || "—"}</span>
        </div>
      </td>
      <td className="p-4 text-xs font-medium text-slate-300 max-w-xs truncate">{item.subject_title || "—"}</td>
      <td className="p-4 text-xs text-slate-400">
        <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">{item.room || "—"}</span>
      </td>
      <td className="p-4 text-xs text-slate-400">{item.year_level || "—"}</td>
      <td className="p-4 text-xs text-slate-400">{item.section_no || "—"}</td>
      <td className="p-4">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={onStartEdit} title="Edit" className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Icon name="edit" size={15} /></button>
          <button onClick={() => onOpenClassOptions(item.id)} title="Options" className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Icon name="grid" size={15} /></button>
          <button onClick={() => onOpenStudents(item.id)} title="Students" className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Icon name="users" size={15} /></button>
          <button onClick={() => onDeleteClass(item)} title="Delete" className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Icon name="trash" size={15} /></button>
        </div>
      </td>
    </tr>
  );
}

// --- Main Dark Aesthetic Classes View ---

function Classes({ sections, section, importMasterList, importGradeSheet, importState, gradeSheetImportState, connectionStatus, pendingSyncCount, onOpenStudents, onOpenClassOptions, onDeleteClass, onUpdateClass }) {
  const [editingId, setEditingId] = useState(null);

  const handleFileUpload = (e, callback) => {
    const file = e.target.files?.[0];
    if (file) callback(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-8">
      {/* Dynamic Header Banner */}
      <div className="relative p-8 rounded-3xl bg-gradient-to-r from-indigo-900/50 via-slate-900 to-purple-900/40 border border-indigo-500/20 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Icon name="sparkles" size={14} /> Presenzio Control Hub
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Classes & Schedules</h1>
            <p className="text-sm text-slate-400">Manage real-time student lists, class options, and grade syncs seamlessly.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm rounded-xl cursor-pointer transition-all shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-95">
              <Icon name="plus" size={18} /> Import Master List
              <input type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => handleFileUpload(e, importMasterList)} />
            </label>
            <label className="flex items-center gap-2 px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 font-semibold text-sm rounded-xl cursor-pointer transition-all backdrop-blur-md shadow-md hover:scale-[1.02] active:scale-95">
              <Icon name="file" size={18} /> Grade Sheet
              <input type="file" accept=".xls,.xlsx,.xlsm" disabled={gradeSheetImportState?.status === "working"} className="hidden" onChange={(e) => handleFileUpload(e, importGradeSheet)} />
            </label>
          </div>
        </div>
      </div>

      {/* Main Glassmorphic Table Container */}
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Enrolled Classes</span>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">{sections.length}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === "live" ? "bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" : "bg-amber-400"}`} />
            {connectionStatus === "offline" ? `Offline ${pendingSyncCount ? `(${pendingSyncCount} pending)` : ""}` : "Live Sync Active"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                {["Days", "Schedule", "EDP Code", "Subject Code", "Subject Title", "Room", "Year", "Sec", "Actions"].map((head) => (
                  <th key={head} className="p-4">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {sections.map((item, index) => (
                <EditableClassRow
                  key={item.id}
                  item={item}
                  index={index}
                  isSelected={item.id === section?.id}
                  isEditing={editingId === item.id}
                  onStartEdit={() => setEditingId(item.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={async (id, draft) => { await onUpdateClass(id, draft); setEditingId(null); }}
                  onOpenClassOptions={onOpenClassOptions}
                  onOpenStudents={onOpenStudents}
                  onDeleteClass={onDeleteClass}
                />
              ))}
            </tbody>
          </table>
          {!sections.length && (
            <div className="p-16 text-center text-slate-500 text-sm">
              <Icon name="file" size={32} className="mx-auto mb-3 opacity-30" />
              No active classes found. Upload a master list to populate your workspace.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Dark Glassmorphic Dashboard Layout ---

export default function DashboardView() {
  const [active, setActive] = useState("classes");
  const [mobileNav, setMobileNav] = useState(false);

  // Mock data demonstration if viewModel isn't provided
  const dummySections = [
    { id: "1", days: "TTh", time_start: "09:00", time_end: "10:30", edp_code: "45210", subject_code: "IT 312", subject_title: "Mobile Application Development", room: "LAB 4B", year_level: "3", section_no: "A1" },
    { id: "2", days: "MWF", time_start: "13:00", time_end: "14:00", edp_code: "45211", subject_code: "CS 201", subject_title: "Data Structures & Algorithms", room: "RM 302", year_level: "2", section_no: "B2" },
  ];

  return (
    <div className="flex h-screen bg-[#0b0f19] font-sans text-slate-100 antialiased overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Glowing background accents */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Glassmorphic Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/80 backdrop-blur-2xl border-r border-slate-800/80 transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col justify-between p-5 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="space-y-8">
          <div className="px-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-500/30">
              P
            </div>
            <div>
              <span className="font-extrabold text-white text-lg tracking-wide block leading-none">Presenzio</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Teacher Edition</span>
            </div>
          </div>

          <nav className="space-y-1.5">
            <p className="px-3 text-[10px] font-extrabold tracking-widest text-slate-500 uppercase mb-3">Main Navigation</p>
            {[
              { id: "overview", label: "Overview", icon: "grid" },
              { id: "classes", label: "Classes Hub", icon: "users" },
              { id: "reports", label: "Grade Reports", icon: "file" },
            ].map((item) => (
              <button key={item.id} onClick={() => setActive(item.id)} className={`flex items-center gap-3.5 w-full px-3.5 py-3 text-sm font-semibold rounded-xl transition-all ${active === item.id ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}`}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="border-t border-slate-800/80 pt-4 space-y-4">
          <button className="flex items-center gap-3 w-full px-3.5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-xl transition-all">
            <Icon name="settings" size={18} /> Settings
          </button>
          <div className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/50 rounded-2xl backdrop-blur-md">
            <Avatar initials="JM" small />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Jeorge Mancilla</p>
              <p className="text-[10px] text-slate-400 truncate">Instructor</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <header className="h-20 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-xl flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-slate-400" onClick={() => setMobileNav(!mobileNav)}>
              <Icon name="grid" size={22} />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Workspace</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400 font-bold">Class Management</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><Icon name="search" size={16} /></span>
              <input placeholder="Search classes or EDP..." className="pl-10 pr-4 py-2 text-xs bg-slate-900/80 border border-slate-800 rounded-full text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52 sm:w-72 transition-all" />
            </div>
            <button className="p-2.5 text-slate-400 hover:text-slate-200 bg-slate-800/40 border border-slate-700/50 rounded-full hover:bg-slate-800 transition-all relative">
              <Icon name="bell" size={18} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/80" />
            </button>
            <Avatar initials="JM" small />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <Classes
            sections={dummySections}
            section={dummySections[0]}
            importMasterList={() => {}}
            importGradeSheet={() => {}}
            connectionStatus="live"
            pendingSyncCount={0}
            onOpenStudents={() => {}}
            onOpenClassOptions={() => {}}
            onDeleteClass={() => {}}
            onUpdateClass={() => {}}
          />
        </main>
      </div>
    </div>
  );
}