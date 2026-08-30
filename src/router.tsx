import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { LoginPage } from '@/components/auth/LoginPage'
import { ForgotPasswordPage } from '@/components/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage'
import { PrivateRoute } from '@/components/auth/PrivateRoute'
import { RoleGuard } from '@/components/auth/RoleGuard'

// ── Lazy loading des pages lourdes ────────────────────────────────────────────
// Chaque import dynamique crée un chunk séparé dans le build.

const DashboardAsnPage = lazy(() =>
  import('@/pages/dashboard/DashboardAsnPage').then(m => ({ default: m.DashboardAsnPage }))
)
const DashboardOsnPage = lazy(() =>
  import('@/pages/dashboard/DashboardOsnPage').then(m => ({ default: m.DashboardOsnPage }))
)
const DashboardGlobalPage = lazy(() =>
  import('@/pages/dashboard/DashboardGlobalPage').then(m => ({ default: m.DashboardGlobalPage }))
)
const DashboardFaritanyPage = lazy(() =>
  import('@/pages/dashboard/DashboardFaritanyPage').then(m => ({ default: m.DashboardFaritanyPage }))
)
const IndiceDeploiementPage = lazy(() =>
  import('@/pages/dashboard/IndiceDeploiementPage').then(m => ({ default: m.IndiceDeploiementPage }))
)
const ValidationPage = lazy(() =>
  import('@/pages/evaluation/ValidationPage').then(m => ({ default: m.ValidationPage }))
)
const EvaluationListPage = lazy(() =>
  import('@/pages/evaluation/EvaluationListPage').then(m => ({ default: m.EvaluationListPage }))
)
const NewEvaluationPage = lazy(() =>
  import('@/pages/evaluation/NewEvaluationPage').then(m => ({ default: m.NewEvaluationPage }))
)
const EvaluationDetailPage = lazy(() =>
  import('@/pages/evaluation/EvaluationDetailPage').then(m => ({ default: m.EvaluationDetailPage }))
)
const CyclesPage = lazy(() =>
  import('@/pages/admin/CyclesPage').then(m => ({ default: m.CyclesPage }))
)
const RevuePage = lazy(() =>
  import('@/pages/admin/RevuePage').then(m => ({ default: m.RevuePage }))
)
const UsersPage = lazy(() =>
  import('@/pages/admin/UsersPage').then(m => ({ default: m.UsersPage }))
)
const ReferentialPage = lazy(() =>
  import('@/pages/admin/referential/ReferentialPage').then(m => ({ default: m.ReferentialPage }))
)
const AuditPage = lazy(() =>
  import('@/pages/admin/audit/AuditPage').then(m => ({ default: m.AuditPage }))
)
const TrackingPage = lazy(() =>
  import('@/pages/tracking/TrackingPage').then(m => ({ default: m.TrackingPage }))
)
const PilotageOsnPage = lazy(() =>
  import('@/components/plan/PilotageOsnPage').then(m => ({ default: m.PilotageOsnPage }))
)
const SystemConfig = lazy(() =>
  import('@/components/admin/SystemConfig').then(m => ({ default: m.SystemConfig }))
)
const OrganisationsPage = lazy(() =>
  import('@/components/admin/organisations/OrganisationsPage').then(m => ({ default: m.OrganisationsPage }))
)
const WorkflowPage = lazy(() =>
  import('@/components/admin/WorkflowPage').then(m => ({ default: m.WorkflowPage }))
)
const WorkflowDetailPage = lazy(() =>
  import('@/pages/admin/WorkflowDetailPage').then(m => ({ default: m.WorkflowDetailPage }))
)
const NotificationCenter = lazy(() =>
  import('@/components/notifications/NotificationCenter').then(m => ({ default: m.NotificationCenter }))
)
const AiAssistantPage = lazy(() =>
  import('@/pages/ai-assistant/AiAssistantPage').then(m => ({ default: m.AiAssistantPage }))
)
const ValidationReportPage = lazy(() =>
  import('@/pages/report/ValidationReportPage').then(m => ({ default: m.ValidationReportPage }))
)

// ── Suspense fallback minimal ─────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <span
        className="material-symbols-outlined animate-spin text-[32px]"
        style={{ color: 'var(--primary)' }}
      >
        progress_activity
      </span>
    </div>
  )
}

// Wraps a lazy component in Suspense
function withSuspense<P extends object>(Component: ComponentType<P>) {
  return function SuspenseWrapper(props: P) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Component {...props} />
      </Suspense>
    )
  }
}

// ── Route elements avec Suspense ──────────────────────────────────────────────

const LazyDashboardAsn = withSuspense(DashboardAsnPage)
const LazyDashboardOsn = withSuspense(DashboardOsnPage)
const LazyDashboardGlobal = withSuspense(DashboardGlobalPage)
const LazyDashboardFaritany = withSuspense(DashboardFaritanyPage)
const LazyIndice = withSuspense(IndiceDeploiementPage)
const LazyValidation = withSuspense(ValidationPage)
const LazyEvaluationList = withSuspense(EvaluationListPage)
const LazyNewEvaluation = withSuspense(NewEvaluationPage)
const LazyEvaluationDetail = withSuspense(EvaluationDetailPage)
const LazyCycles = withSuspense(CyclesPage)
const LazyRevue = withSuspense(RevuePage)
const LazyUsers = withSuspense(UsersPage)
const LazyReferential = withSuspense(ReferentialPage)
const LazyAudit = withSuspense(AuditPage)
const LazyTracking = withSuspense(TrackingPage)
const LazyPilotage = withSuspense(PilotageOsnPage)
const LazySystemConfig = withSuspense(SystemConfig)
const LazyOrganisations = withSuspense(OrganisationsPage)
const LazyWorkflow = withSuspense(WorkflowPage)
const LazyWorkflowDetail = withSuspense(WorkflowDetailPage)
const LazyNotifications = withSuspense(NotificationCenter)
const LazyAiAssistant = withSuspense(AiAssistantPage)
const LazyValidationReport = withSuspense(ValidationReportPage)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/',
    element: (
      <PrivateRoute>
        <AppLayout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard/asn" replace /> },
      { path: 'dashboard', element: <Navigate to="/dashboard/asn" replace /> },
      { path: 'dashboard/asn', element: <LazyDashboardAsn /> },
      { path: 'dashboard/faritany', element: <LazyDashboardFaritany /> },
      {
        path: 'dashboard/osn',
        element: <RoleGuard roles={['admin_global', 'responsable_osn', 'responsable_region']}><LazyDashboardOsn /></RoleGuard>,
      },
      {
        path: 'dashboard/indice',
        element: <RoleGuard roles={['admin_global', 'responsable_osn', 'responsable_region']}><LazyIndice /></RoleGuard>,
      },
      {
        path: 'dashboard/global',
        element: <RoleGuard roles={['admin_global']}><LazyDashboardGlobal /></RoleGuard>,
      },
      {
        path: 'evaluation',
        element: <LazyEvaluationList />,
      },
      {
        path: 'evaluation/new',
        element: <LazyNewEvaluation />,
      },
      {
        path: 'evaluation/:evalId',
        element: <LazyEvaluationDetail />,
      },
      {
        path: 'evaluation/validate/:evalId',
        element: <LazyValidation />,
      },
      {
        path: 'action-plan',
        element: <LazyTracking />,
      },
      {
        path: 'tracking',
        element: <LazyPilotage />,
      },
      {
        path: 'admin/users',
        element: <RoleGuard roles={['admin_global']}><LazyUsers /></RoleGuard>,
      },
      {
        path: 'admin/cycles',
        element: <RoleGuard roles={['admin_global', 'responsable_osn']}><LazyCycles /></RoleGuard>,
      },
      {
        path: 'admin/revue',
        element: <RoleGuard roles={['admin_global', 'responsable_osn', 'responsable_region']}><LazyRevue /></RoleGuard>,
      },
      {
        path: 'admin/referential',
        element: <RoleGuard roles={['admin_global']}><LazyReferential /></RoleGuard>,
      },
      {
        path: 'admin/audit',
        element: <RoleGuard roles={['admin_global']}><LazyAudit /></RoleGuard>,
      },
      {
        path: 'settings',
        element: <RoleGuard roles={['admin_global']}><LazySystemConfig /></RoleGuard>,
      },
      {
        path: 'admin/organisations',
        element: <RoleGuard roles={['admin_global']}><LazyOrganisations /></RoleGuard>,
      },
      {
        path: 'admin/workflow',
        element: <RoleGuard roles={['admin_global', 'responsable_osn']}><LazyWorkflow /></RoleGuard>,
      },
      {
        path: 'admin/workflow/:campaignId',
        element: <RoleGuard roles={['admin_global', 'responsable_osn']}><LazyWorkflowDetail /></RoleGuard>,
      },
      {
        path: 'notifications',
        element: <LazyNotifications />,
      },
      {
        path: 'ai-assistant',
        element: <LazyAiAssistant />,
      },
      {
        path: 'report/validation/:evalId',
        element: <LazyValidationReport />,
      },
    ],
  },
])
