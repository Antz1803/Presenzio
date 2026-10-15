import { lazy, Suspense } from "react";
import { useState as a, useEffect as useReactEffect } from "react";
import {
  useLocation as useRouterLocation,
  useNavigate as useRouterNavigate,
} from "react-router-dom";
import { useDashboardViewModel as F } from "../ViewModels/useDashboardViewModel";
import { navItems as J } from "../Models/dashboardModel";
const Q = lazy(() => import("./ClassActionModal"));
const X = lazy(() => import("./ClassesView"));
const Y = lazy(() => import("./OverviewView"));
const Z = lazy(() => import("./ReportsView"));
const MaterialsView = lazy(() => import("./MaterialsView"));
const PrintReportModal = lazy(() => import("./PrintReportModal"));
import { Icon as G } from "./DashboardShared";
import {
  ClassOptionsModal as ClassOptionsModalView,
  DeleteClassModal as DeleteClassModalView,
  StudentModal as StudentModalView,
  LiveClock,
} from "./DashboardOverlays";
import "../../App.css"; // legacy: still used by Classes/Materials/modals until migrated
import { useAuth as ie } from "../../auth/useAuth";
import { useBranding as useBrandingSettings } from "../../lib/branding";
import ProfileDetailsModal from "../../auth/ProfileDetailsModal";
function studentViewSlug(section) {
  const parts = [section?.subject_code, section?.section_no]
    .filter(Boolean)
    .join(" section ");
  return (
    (parts || section?.subject_title || "class")
      .toString()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "class"
  );
}
export default function DashboardShell() {
  const e = F(),
    location = useRouterLocation(),
    navigate = useRouterNavigate(),
    { user: n, logout: T, updateInstructorProfile: I } = ie(),
    { branding } = useBrandingSettings(),
    k = (() => {
      const s = n?.user_metadata?.instructor_profile || {},
        t =
          s.name ||
          n?.user_metadata?.full_name ||
          n?.email?.split("@")[0] ||
          "Teacher";
      return {
        name: t,
        position: s.position || "Instructor",
        gmail: s.gmail || n?.email || "",
        facebook: s.facebook || "",
        courses: Array.isArray(s.courses) ? s.courses : [],
        initials:
          s.initials ||
          t
            .split(/\s+/)
            .map((q) => q[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        color: s.color || "bg-linear-to-br from-accent-2 to-accent-3",
        avatarUrl: s.avatarUrl || "",
        printLogoLeftUrl: s.printLogoLeftUrl || "",
        printLogoRightUrl: s.printLogoRightUrl || "",
      };
    })(),
    logoBrandHeight = Math.max(
      30,
      Number(branding.logoHeight || 0) +
        Number(branding.logoMarginTop || 0) +
        Number(branding.logoMarginBottom || 0),
    ),
    [R, f] = a(null),
    [p, g] = a(null),
    [l, b] = a(null),
    [r, A] = a(null),
    [d, u] = a(null),
    [U, v] = a(""),
    [C, y] = a(!1),
    [L, h] = a(!1),
    i = e.sections.find((s) => s.id === e.section?.id) ?? e.section,
    S = e.sections.find((s) => s.id === R),
    _ = e.sections.find((s) => s.id === p),
    w = e.sections.find((s) => s.id === l?.sectionId),
    o = i?.id === l?.sectionId,
    N = e.sections.find((s) => s.id === r?.sectionId),
    V = i?.id === r?.sectionId,
    m = (s) => e.selectSection(s),
    M = (s) => {
      (m(s), f(s));
    },
    P = (s, t = i?.id) => {
      (t && m(t), b({ type: s, sectionId: t }));
    },
    E = (s, t = i?.id) => {
      (t && m(t), A({ type: s, sectionId: t }));
    },
    z = (section) =>
      window.open(
        `${window.location.origin}/student/${studentViewSlug(section)}`,
        "_blank",
        "noopener,noreferrer",
      ),
    $ = async () => {
      if (d) {
        (y(!0), v(""));
        try {
          (await e.deleteSection(d.id), u(null));
        } catch (s) {
          v(s.message || "The class could not be deleted.");
        } finally {
          y(!1);
        }
      }
    },
    c = () => b(null),
    j = () => A(null),
    O = n?.user_metadata?.full_name || n?.email?.split("@")[0] || "Teacher",
    x = O.split(/\s+/)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    W = async () => {
      try {
        await T();
      } catch (s) {
        window.alert(s?.message || "Could not log out.");
      }
    },
    routeActive = location.pathname.match(/^\/dashboard\/(overview|classes|reports|materials)$/)?.[1] || "overview";
  useReactEffect(() => {
    if (e.active !== routeActive) e.setActive(routeActive);
  }, [e.active, e.setActive, routeActive]);
    const H =
      routeActive === "classes" ? (
        <X
          sections={e.sections}
          section={i}
          importMasterList={e.importMasterList}
          importGradeSheet={e.importGradeSheet}
          onSyncAllToExcel={e.syncAllToExcel}
          importState={e.importState}
          gradeSheetImportState={e.gradeSheetImportState}
          connectionStatus={e.connectionStatus}
          connectionMessage={e.connectionMessage}
          pendingSyncCount={e.pendingSyncCount}
          onOpenStudents={(s) => {
            g(s);
            m(s);
          }}
          onOpenClassOptions={M}
          onDeleteClass={(s) => {
            v("");
            u(s);
          }}
          onUpdateClass={e.updateSection}
        />
      ) : routeActive === "reports" ? (
        <Z />
      ) : routeActive === "materials" ? (
        <MaterialsView />
      ) : (
        <Y
          setActive={e.setActive}
          instructor={k}
          onUpdateInstructor={I}
          students={e.students}
          stats={e.stats}
          sections={e.sections}
          onOpenClassOptions={M}
          onOpenAction={P}
        />
      ),
    K = {
      type: l?.type,
      section: w,
      instructor: k,
      students: o ? e.students : [],
      assessmentScores: o ? e.assessmentScores : [],
      assessmentDefinitions: o ? e.assessmentDefinitions : [],
      studentGroups: o ? e.studentGroups : [],
      sessions: o ? e.sessions : [],
      attendanceSessions: o ? e.attendanceSessions : [],
      gradingPeriods: o ? e.gradingPeriods : [],
      stats: o
        ? e.stats
        : {
            sessionsHeld: 0,
            monthAttendance: "\u2014",
            classAverage: "\u2014",
            passingRate: "\u2014",
            excellentCount: 0,
            needsReviewCount: 0,
          },
      loading: !o,
      onClose: c,
      onSaveAttendance: async (s, options = {}) => {
        (await e.saveAttendance(s), options.keepOpen || c());
      },
      onDeleteAttendance: async (s) => {
        await e.deleteAttendance(s);
      },
      onSaveAssessmentScores: async (s, options = {}) => {
        (await e.saveAssessmentScores(s), options.keepOpen || c());
      },
      onAutoSaveAssessmentScores: e.saveAssessmentScores,
      onSaveAssessment: e.saveAssessment,
      onUpdateAssessment: e.updateAssessment,
      onGrantAssessmentAttempt: e.grantAssessmentAttempt,
      onDeleteAssessment: e.deleteAssessment,
      onSubmitAssessment: e.submitAssessment,
      onSaveGradingPeriods: async (s) => {
        (await e.saveGradingPeriods(s), c());
      },
      onAddStudent: async (s) => {
        (await e.addStudent(s), c());
      },
      onRefreshGrades: e.refreshGrades,
      onRefreshLiveData: e.refresh,
      onSaveStudentGroup: e.saveStudentGroup,
      onUpdateStudentGroup: e.updateStudentGroup,
      onDeleteStudentGroup: e.deleteStudentGroup,
    };
  return (
    <>
      <div className="relative isolate min-h-screen bg-canvas font-sans text-sm text-ink-2">
        {e.mobileNav && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-20 bg-canvas/70 backdrop-blur-sm lg:hidden print:hidden"
            onClick={() => e.setMobileNav(false)}
          />
        )}

        {/* ---------------- Sidebar ---------------- */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col justify-between border-r border-accent/15 bg-surface-1 shadow-2xl transition-transform duration-200 lg:translate-x-0 print:hidden ${
            e.mobileNav ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="min-h-0 overflow-y-auto">
            <div
              className="relative flex items-center justify-center overflow-hidden border-b border-slate-800/80 px-6 py-6"
              style={{ minHeight: `${logoBrandHeight}px` }}
            >
              <div className="pointer-events-none absolute -left-12 -top-12 size-28 rounded-full bg-accent/10 blur-2xl" />
              <img
                className="relative object-contain drop-shadow-[0_0_8px_rgba(0,240,255,0.25)]"
                src={branding.logo}
                alt={branding.appName}
                style={{
                  width: `${branding.logoWidth}px`,
                  height: `${branding.logoHeight}px`,
                  maxWidth: "100%",
                  marginTop: `${branding.logoMarginTop}px`,
                  marginRight: `${branding.logoMarginRight}px`,
                  marginBottom: `${branding.logoMarginBottom}px`,
                  marginLeft: `${branding.logoMarginLeft}px`,
                }}
              />
            </div>

            <div className="px-4 py-6">
              <p className="mb-3 px-3 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-3">
                Workspace
              </p>
              <nav aria-label="Workspace navigation" className="space-y-1.5">
                {J.map((s) => {
                  const isActive = e.active === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => {
                        e.setActive(s.id);
                        e.setMobileNav(false);
                        navigate(`/dashboard/${s.id}`);
                      }}
                      className={`group flex w-full items-center gap-3 border text-left font-medium transition-all ${
                        isActive
                          ? "rounded-[22px] border-[#43357b]/50 bg-[#2b2250] px-4 py-3 text-[#c4b5fd] shadow-[inset_6px_0_0_0_#a855f7,0_4px_14px_rgba(0,0,0,0.25)]"
                          : "rounded-xl border-transparent px-3.5 py-2.5 text-ink-2 hover:border-accent/20 hover:bg-slate-800/60 hover:text-accent"
                      }`}
                    >
                      <span
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? "ml-1.5 text-[#a855f7]"
                            : "text-ink-3 group-hover:text-accent"
                        }`}
                      >
                        <G name={s.icon} size={20} />
                      </span>
                      <span
                        className={isActive ? "text-sm font-semibold" : "text-sm"}
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="border-t border-slate-800/80 p-4">
            <button
              type="button"
              onClick={() => h(true)}
              className="mb-3 flex w-full items-center gap-3 px-3 py-2 text-xs font-medium text-ink-2 transition-colors hover:text-accent"
            >
              <G name="settings" size={16} />
              <span>Settings</span>
            </button>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-accent/20 bg-surface-2 p-2.5 shadow-sm">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-tr from-accent to-[#0D82FF] font-mono text-xs font-black text-canvas shadow-sm shadow-accent/30">
                  {x || "T"}
                </span>
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-bold text-ink" title={O}>
                    {O}
                  </h4>
                  <p
                    className="truncate text-[10px] text-ink-2"
                    title={n?.email || "Teacher account"}
                  >
                    {n?.email || "Teacher account"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={W}
                title="Log out"
                aria-label="Log out"
                className="shrink-0 rounded p-1.5 text-ink-2 transition-colors hover:text-red-400"
              >
                <G name="logout" size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* ---------------- Main ---------------- */}
        <main className="relative z-[1] min-h-screen p-4 sm:p-6 lg:ml-64 lg:p-8 print:hidden">
          <header className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => e.setMobileNav(!e.mobileNav)}
              aria-label="Toggle navigation"
              className="grid size-9 place-items-center rounded border border-accent/30 bg-surface-1 text-accent transition hover:bg-accent/10 lg:hidden"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="ml-auto hidden sm:block">
              <LiveClock />
            </div>
          </header>

          <Suspense
            fallback={
              <div className="p-6 font-mono text-xs uppercase tracking-widest text-ink-3">
                Loading…
              </div>
            }
          >
            {H}
          </Suspense>
        </main>

        {/* ---------------- Overlays ---------------- */}
        {S && !l && !r && (
          <ClassOptionsModalView
            section={S}
            onClose={() => f(null)}
            onOpenAction={P}
            onOpenPrint={E}
            onOpenStudentView={z}
            onSyncToExcel={e.syncToExcel}
            syncReady={i?.id === S.id}
          />
        )}
        {p && (
          <StudentModalView
            section={_}
            sections={e.sections}
            students={i?.id === p ? e.students : []}
            onUpdateStudent={e.updateStudent}
            onDeleteStudent={e.deleteStudent}
            onTransferStudent={e.transferStudent}
            onLoadTransferPreview={e.loadTransferPreview}
            onClose={() => g(null)}
          />
        )}
        {d && (
          <DeleteClassModalView
            section={d}
            deleting={C}
            error={U}
            onClose={() => !C && u(null)}
            onConfirm={$}
          />
        )}
        {l && w && !r && (
          <Suspense fallback={<FullScreenMessage text="Loading…" />}>
            <Q {...K} />
          </Suspense>
        )}
        {r &&
          N &&
          (V ? (
            <Suspense fallback={<FullScreenMessage text="Loading…" />}>
              <PrintReportModal
                type={r.type}
                section={N}
                students={e.students}
                assessmentScores={e.assessmentScores}
                attendanceSessions={e.attendanceSessions}
                gradingPeriods={e.gradingPeriods}
                instructorName={k.name}
                printLogoLeftUrl={k.printLogoLeftUrl}
                printLogoRightUrl={k.printLogoRightUrl}
                onClose={j}
              />
            </Suspense>
          ) : (
            <FullScreenMessage text="Loading class data…" />
          ))}
        {L && <ProfileDetailsModal onClose={() => h(false)} />}
      </div>
    </>
  );
}

function FullScreenMessage({ text }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas font-mono text-xs uppercase tracking-widest text-ink-3 print:hidden">
      {text}
    </div>
  );
}
