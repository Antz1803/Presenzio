import { useState, useMemo } from "react";
import { useDashboardViewModel } from "../ViewModels/useDashboardViewModel";
import { navItems } from "../Models/dashboardModel";
import ClassActionModal from "./ClassActionModal";
import ClassesView from "./ClassesView";
import OverviewView from "./OverviewView";
import ReportsView from "./ReportsView";
import PrintReportModal from "./PrintReportModal";
import { Avatar, Icon } from "./DashboardShared";
import { ClassOptionsModal, DeleteClassModal, LiveClock, StudentModal } from "./DashboardOverlays";
import logo from "../../assets/Logo.png";
import "../../App.css";
import { useAuth } from "../../auth/useAuth";
import ProfileDetailsModal from "../../auth/ProfileDetailsModal";
import { getStoredInstructorAvatar } from "../../auth/profileStorage";

export default function DashboardShell() {
  const viewModel = useDashboardViewModel();
  const { user, logout, updateInstructorProfile } = useAuth();

  const instructorProfile = useMemo(() => {
    const saved = user?.user_metadata?.instructor_profile || {};
    const name = saved.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";
    return {
      name,
      position: saved.position || "Instructor",
      gmail: saved.gmail || user?.email || "",
      facebook: saved.facebook || "",
      courses: Array.isArray(saved.courses) ? saved.courses : [],
      initials: saved.initials || name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      color: saved.color || "bg-gradient-to-br from-indigo-500 to-violet-600",
      avatarUrl: getStoredInstructorAvatar(user?.id),
    };
  }, [user]);

  const [classOptionsId, setClassOptionsId] = useState(null);
  const [studentModalId, setStudentModalId] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [printModal, setPrintModal] = useState(null);
  const [deleteClass, setDeleteClass] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletingClass, setDeletingClass] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const selectedSection =
    viewModel.sections.find((item) => item.id === viewModel.section?.id) ?? viewModel.section;
  const optionsSection = viewModel.sections.find((item) => item.id === classOptionsId);
  const studentSection = viewModel.sections.find((item) => item.id === studentModalId);
  const actionSection = viewModel.sections.find((item) => item.id === actionModal?.sectionId);
  const actionReady = selectedSection?.id === actionModal?.sectionId;
  const printSection = viewModel.sections.find((item) => item.id === printModal?.sectionId);
  const printReady = selectedSection?.id === printModal?.sectionId;

  const selectSection = (sectionId) => viewModel.selectSection(sectionId);

  const openClassOptions = (sectionId) => {
    selectSection(sectionId);
    setClassOptionsId(sectionId);
  };

  const openAction = (type, sectionId = selectedSection?.id) => {
    if (sectionId) selectSection(sectionId);
    setActionModal({ type, sectionId });
  };

  const openPrint = (type, sectionId = selectedSection?.id) => {
    if (sectionId) selectSection(sectionId);
    setPrintModal({ type, sectionId });
  };

  const openStudentView = (sectionId) =>
    window.open(
      `${window.location.origin}/?view=student&section=${encodeURIComponent(sectionId)}`,
      "_blank",
      "noopener,noreferrer"
    );

  const confirmDelete = async () => {
    if (!deleteClass) return;
    setDeletingClass(true);
    setDeleteError("");
    try {
      await viewModel.deleteSection(deleteClass.id);
      setDeleteClass(null);
    } catch (error) {
      setDeleteError(error.message || "The class could not be deleted.");
    } finally {
      setDeletingClass(false);
    }
  };

  const closeAction = () => setActionModal(null);
  const closePrint = () => setPrintModal(null);
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teacher";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      window.alert(error?.message || "Could not log out.");
    }
  };

  const page =
    viewModel.active === "classes" ? (
      <ClassesView
        sections={viewModel.sections}
        section={selectedSection}
        importMasterList={viewModel.importMasterList}
        importGradeSheet={viewModel.importGradeSheet}
        importState={viewModel.importState}
        gradeSheetImportState={viewModel.gradeSheetImportState}
        connectionStatus={viewModel.connectionStatus}
        connectionMessage={viewModel.connectionMessage}
        pendingSyncCount={viewModel.pendingSyncCount}
        onOpenStudents={(sectionId) => {
          setStudentModalId(sectionId);
          selectSection(sectionId);
        }}
        onOpenClassOptions={openClassOptions}
        onDeleteClass={(item) => {
          setDeleteError("");
          setDeleteClass(item);
        }}
        onUpdateClass={viewModel.updateSection}
      />
    ) : viewModel.active === "reports" ? (
      <ReportsView />
    ) : (
      <OverviewView
        setActive={viewModel.setActive}
        instructor={instructorProfile}
        onUpdateInstructor={updateInstructorProfile}
        students={viewModel.students}
        stats={viewModel.stats}
        sections={viewModel.sections}
        onOpenClassOptions={openClassOptions}
        onOpenAction={openAction}
      />
    );

  const actionProps = {
    type: actionModal?.type,
    section: actionSection,
    students: actionReady ? viewModel.students : [],
    assessmentScores: actionReady ? viewModel.assessmentScores : [],
    assessmentDefinitions: actionReady ? viewModel.assessmentDefinitions : [],
    sessions: actionReady ? viewModel.sessions : [],
    attendanceSessions: actionReady ? viewModel.attendanceSessions : [],
    gradingPeriods: actionReady ? viewModel.gradingPeriods : [],
    stats: actionReady
      ? viewModel.stats
      : {
          sessionsHeld: 0,
          monthAttendance: "—",
          classAverage: "—",
          passingRate: "—",
          excellentCount: 0,
          needsReviewCount: 0,
        },
    loading: !actionReady,
    onClose: closeAction,
    onSaveAttendance: async (payload) => {
      await viewModel.saveAttendance(payload);
      closeAction();
    },
    onSaveAssessmentScores: async (payload) => {
      await viewModel.saveAssessmentScores(payload);
      closeAction();
    },
    onAutoSaveAssessmentScores: viewModel.saveAssessmentScores,
    onSaveAssessment: viewModel.saveAssessment,
    onUpdateAssessment: viewModel.updateAssessment,
    onGrantAssessmentAttempt: viewModel.grantAssessmentAttempt,
    onDeleteAssessment: viewModel.deleteAssessment,
    onSubmitAssessment: viewModel.submitAssessment,
    onSaveGradingPeriods: async (payload) => {
      await viewModel.saveGradingPeriods(payload);
      closeAction();
    },
    onAddStudent: async (payload) => {
      await viewModel.addStudent(payload);
      closeAction();
    },
    onRefreshGrades: viewModel.refreshGrades,
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar print:hidden ${viewModel.mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <img className="brand-logo" src={logo} alt="Presenzio" />
        </div>

        <div className="sidebar-section">
          <p className="nav-label">WORKSPACE</p>
          <nav aria-label="Workspace navigation">
            {navItems.map((item) => (
              <button
                className={`nav-item ${viewModel.active === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => {
                  viewModel.setActive(item.id);
                  viewModel.setMobileNav(false);
                }}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <button className="nav-item" type="button" onClick={() => setProfileModalOpen(true)}>
            <Icon name="settings" size={18} />
            <span>Settings</span>
          </button>

          <div className="profile">
            <Avatar initials={initials || "T"} color="blue" small />
            <span>
              <b>{displayName}</b>
              <small>{user?.email || "Teacher account"}</small>
            </span>
            <button className="ml-auto text-xs font-semibold text-slate-400 transition hover:text-rose-500" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content print:hidden">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => viewModel.setMobileNav(!viewModel.mobileNav)}
            aria-label="Toggle navigation"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="space">            
          </div>

          <div className="topbar-actions flex items-center gap-3">
            <LiveClock />
            <Avatar initials={initials || "T"} color="blue" small />
          </div>
        </header>

        <div className="content-wrap">{page}</div>
      </main>

      {optionsSection && !actionModal && !printModal && (
        <ClassOptionsModal
          section={optionsSection}
          onClose={() => setClassOptionsId(null)}
          onOpenAction={openAction}
          onOpenPrint={openPrint}
          onOpenStudentView={openStudentView}
          onSyncToExcel={viewModel.syncToExcel}
          syncReady={selectedSection?.id === optionsSection.id}
        />
      )}

      {studentModalId && (
        <StudentModal
          section={studentSection}
          students={selectedSection?.id === studentModalId ? viewModel.students : []}
          onUpdateStudent={viewModel.updateStudent}
          onClose={() => setStudentModalId(null)}
        />
      )}

      {deleteClass && (
        <DeleteClassModal
          section={deleteClass}
          deleting={deletingClass}
          error={deleteError}
          onClose={() => !deletingClass && setDeleteClass(null)}
          onConfirm={confirmDelete}
        />
      )}

      {actionModal && actionSection && !printModal && <ClassActionModal {...actionProps} />}

      {printModal && printSection && (
        printReady ? (
          <PrintReportModal
            type={printModal.type}
            section={printSection}
            students={viewModel.students}
            assessmentScores={viewModel.assessmentScores}
            attendanceSessions={viewModel.attendanceSessions}
            gradingPeriods={viewModel.gradingPeriods}
            onClose={closePrint}
          />
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 print:hidden">
            <p className="text-sm text-slate-500">Loading class data…</p>
          </div>
        )
      )}

      {profileModalOpen && <ProfileDetailsModal onClose={() => setProfileModalOpen(false)} />}
    </div>
  );
}
