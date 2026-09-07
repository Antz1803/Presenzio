import { Icon } from "../DashboardShared";

export default function StatCard({ label, value, note, icon, trend }) {
  return (
    <article className="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 flex flex-col justify-between hover:translate-y-[-2px] transition-all">
      <div className="flex justify-between items-center mb-3">
        <span className="p-2.5 rounded-2xl bg-slate-100/80 text-slate-700 backdrop-blur-md">
          <Icon name={icon} size={18} />
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{trend}</span>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <strong className="text-2xl font-black text-slate-900 tracking-tight">{value}</strong>
      </div>
      <p className="text-xs font-medium text-slate-400 mt-1">{note}</p>
    </article>
  );
}

