"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import {
  approveAdminRegistration,
  fetchAdminRegistrations,
  rejectAdminRegistration,
} from "@/lib/admin-registrations/api";
import type { AdminRegistrationRecord } from "@/lib/admin-registrations/types";
import {
  getAuthEpoch,
  getMemoryAccessToken,
  getMemorySession,
  subscribeAuth,
} from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

const AVAILABLE_ROLES = [
  { key: "AGENCY_OFFICER", name: "Agency Line Officer", desc: "Institutional operations & data reporting" },
  { key: "PROJECT_MANAGER", name: "Project Manager", desc: "Milestone, corridor and contractor leadership" },
  { key: "INSPECTOR", name: "Site Inspector", desc: "Field telemetry, geo-inspections and verification" },
  { key: "GOV_ADMIN", name: "Government Administrator", desc: "Cross-agency corridor coordination & governance" },
  { key: "CONTRACTOR", name: "External Contractor", desc: "Work order execution & tender milestones" },
  { key: "SUPER_ADMIN", name: "Super Administrator", desc: "Full sovereign infrastructure access & system core" },
] as const;

export function AdminRegistrationsPageClient() {
  const [locale] = useWorkspaceLocale();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const epoch = useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
  const hasToken = useSyncExternalStore(
    subscribeAuth,
    () => Boolean(getMemoryAccessToken()),
    () => false,
  );
  const actor = useSyncExternalStore(
    subscribeAuth,
    () => getMemorySession()?.user ?? null,
    () => null,
  );

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<AdminRegistrationRecord | null>(null);

  // Approval modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [targetRoleKey, setTargetRoleKey] = useState<string>("AGENCY_OFFICER");
  const [targetAgencyCode, setTargetAgencyCode] = useState<string>("");
  const [approvalNotes, setApprovalNotes] = useState<string>("Statutory institutional officer verification confirmed.");

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const queryKey = [
    "admin",
    "registrations",
    epoch,
    actor?.id ?? null,
    { page, q, status: statusFilter },
  ] as const;

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchAdminRegistrations({
        page,
        q: q.trim() || undefined,
        status: statusFilter,
        limit: 15,
      }),
    enabled: hasToken && Boolean(actor),
  });

  const agenciesQuery = useQuery({
    queryKey: ["admin", "agencies", epoch],
    queryFn: () => fetchAgencies({ status: "ACTIVE" }),
    enabled: hasToken && Boolean(actor),
  });

  // Automatically select request if ?id= is present in URL (e.g. from admin email button)
  const urlRequestId = searchParams.get("id") || searchParams.get("requestId");
  useEffect(() => {
    if (urlRequestId && listQuery.data?.items) {
      const match = listQuery.data.items.find((item) => item.id === urlRequestId);
      if (match) {
        setSelectedRequest(match);
        setTargetAgencyCode(match.organizationCode);
      }
    }
  }, [urlRequestId, listQuery.data?.items]);

  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      roleKey,
      agencyCode,
      notes,
    }: {
      id: string;
      roleKey: string;
      agencyCode?: string;
      notes?: string;
    }) => {
      return approveAdminRegistration(id, {
        roleKey,
        agencyCode: agencyCode || undefined,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setShowApproveModal(false);
      setSelectedRequest(null);
      setFeedback({
        type: "success",
        message: "Applicant registration approved. Account is now ACTIVE and an activation email has been sent.",
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to approve registration request.",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return rejectAdminRegistration(id, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "registrations"] });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setFeedback({
        type: "success",
        message: "Registration request rejected. A notification email has been dispatched to the applicant.",
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to reject registration request.",
      });
    },
  });

  const counts = listQuery.data?.counts ?? {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  const isSuperAdmin = actor?.roleKey === "SUPER_ADMIN" || actor?.roleKey === "GOV_ADMIN";

  return (
    <StaffWorkspaceShell title="Registration Requests" wide>
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        {/* Top Header & Breadcrumbs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Link href="/admin/users" className="hover:text-primary transition-colors">
                Staff Directory
              </Link>
              <span>/</span>
              <span className="text-primary font-bold">Institutional Access Queue</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Registration Requests &amp; Approvals
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Review and authenticate statutory officer signup requests prior to granting platform access.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => listQuery.refetch()}
              disabled={listQuery.isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${listQuery.isFetching ? "animate-spin" : ""}`} />
              <span>Refresh Queue</span>
            </button>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              <User className="h-3.5 w-3.5" />
              <span>Active Staff Directory</span>
            </Link>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback ? (
          <div
            className={`flex items-start justify-between rounded-lg p-4 text-sm ${
              feedback.type === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                : "border border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div
            onClick={() => setStatusFilter("PENDING")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              statusFilter === "PENDING"
                ? "border-amber-500 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20 dark:bg-amber-950/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider dark:text-amber-400">
                Pending Approval
              </span>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {counts.pending}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Requires administrator action</div>
          </div>

          <div
            onClick={() => setStatusFilter("APPROVED")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              statusFilter === "APPROVED"
                ? "border-emerald-500 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20 dark:bg-emerald-950/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider dark:text-emerald-400">
              Approved
            </span>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              {counts.approved}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Granted active access</div>
          </div>

          <div
            onClick={() => setStatusFilter("REJECTED")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              statusFilter === "REJECTED"
                ? "border-rose-500 bg-rose-50/50 shadow-md ring-2 ring-rose-500/20 dark:bg-rose-950/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider dark:text-rose-400">
              Declined
            </span>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              {counts.rejected}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Rejected applications</div>
          </div>

          <div
            onClick={() => setStatusFilter("ALL")}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              statusFilter === "ALL"
                ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">
              Total Logged
            </span>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
              {counts.total}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">All historical registrations</div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by officer name, email, department or reference code..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pr-4 pl-9 text-xs text-slate-900 transition-colors focus:border-primary focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800">
              {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setStatusFilter(tab);
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 transition-all ${
                    statusFilter === tab
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {listQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !listQuery.data?.items || listQuery.data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                No registration requests found
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {statusFilter === "PENDING"
                  ? "All statutory registration requests have been cleared and verified."
                  : "No requests match the selected search or filter criteria."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">Reference / Applicant</th>
                    <th scope="col" className="px-4 py-3">Institution &amp; Division</th>
                    <th scope="col" className="px-4 py-3">Designation &amp; Responsibility</th>
                    <th scope="col" className="px-4 py-3">Registered At</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {listQuery.data.items.map((item) => (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-[10px] font-bold text-primary">
                          {item.referenceCode}
                        </div>
                        <div className="mt-0.5 font-bold text-slate-900 dark:text-white">
                          {item.fullName}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span>{item.email}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{item.organizationName}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {item.organizationCode}
                          </span>
                        </div>
                        <div className="mt-0.5 text-slate-500">{item.department}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {item.designation}
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {item.requestedResponsibility.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {item.status === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            <span>PENDING APPROVAL</span>
                          </span>
                        ) : item.status === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>APPROVED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            <X className="h-3 w-3" />
                            <span>DECLINED</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedRequest(item);
                              setTargetAgencyCode(item.organizationCode);
                            }}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Review Dossier
                          </button>

                          {item.status === "PENDING" && isSuperAdmin ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRequest(item);
                                  setTargetAgencyCode(item.organizationCode);
                                  setShowApproveModal(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                              >
                                <UserCheck className="h-3 w-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(item);
                                  setShowRejectModal(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 border border-rose-200 transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300"
                              >
                                <UserX className="h-3 w-3" />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {listQuery.data?.total && listQuery.data.total > 15 ? (
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div>
              Showing {(page - 1) * 15 + 1} - {Math.min(page * 15, listQuery.data.total)} of{" "}
              {listQuery.data.total} requests
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 px-3 py-1 font-medium disabled:opacity-40 dark:border-slate-700"
              >
                Previous
              </button>
              <button
                disabled={page * 15 >= listQuery.data.total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-slate-300 px-3 py-1 font-medium disabled:opacity-40 dark:border-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {/* Detailed Review Dossier Drawer / Modal */}
        {selectedRequest && !showApproveModal && !showRejectModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <button
                onClick={() => setSelectedRequest(null)}
                className="absolute top-4 right-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <Shield className="h-4 w-4" />
                <span>Statutory Clearance Dossier</span>
              </div>

              <div className="mt-1 flex items-baseline justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedRequest.fullName}
                </h2>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {selectedRequest.referenceCode}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/75 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                <div>
                  <div className="text-slate-500">Official Work Email</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{selectedRequest.email}</div>
                </div>
                <div>
                  <div className="text-slate-500">Institution / Entity</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {selectedRequest.organizationName} ({selectedRequest.organizationCode})
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Division / Department</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{selectedRequest.department}</div>
                </div>
                <div>
                  <div className="text-slate-500">Professional Designation</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{selectedRequest.designation}</div>
                </div>
                <div>
                  <div className="text-slate-500">Requested Operational Access</div>
                  <div className="font-bold text-amber-700 dark:text-amber-400">
                    {selectedRequest.requestedResponsibility.replace(/_/g, " ")}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Application Date</div>
                  <div className="text-slate-900 dark:text-white">
                    {new Date(selectedRequest.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {selectedRequest.rejectionReason ? (
                <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-900 dark:text-rose-200">
                  <div className="font-bold">Rejection Note:</div>
                  <div className="mt-0.5">{selectedRequest.rejectionReason}</div>
                </div>
              ) : null}

              {selectedRequest.approvalNotes ? (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="font-bold">Administrative Approval Remarks:</div>
                  <div className="mt-0.5">{selectedRequest.approvalNotes}</div>
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                {selectedRequest.status === "PENDING" && isSuperAdmin ? (
                  <>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                    >
                      Reject Application
                    </button>
                    <button
                      onClick={() => setShowApproveModal(true)}
                      className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                    >
                      Approve &amp; Activate
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Approval Modal */}
        {showApproveModal && selectedRequest ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" />
                <span>Authorize Institutional Account</span>
              </div>

              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                Approve {selectedRequest.fullName}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Assign authorized system role and agency binding. The user will be created with ACTIVE status and emailed immediately.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    System Role Assignment
                  </label>
                  <select
                    value={targetRoleKey}
                    onChange={(e) => setTargetRoleKey(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {AVAILABLE_ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name} ({r.key}) — {r.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Institutional Agency Binding
                  </label>
                  <select
                    value={targetAgencyCode}
                    onChange={(e) => setTargetAgencyCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Auto-resolve from applicant ({selectedRequest.organizationCode})</option>
                    {agenciesQuery.data?.agencies?.map((ag) => (
                      <option key={ag.id} value={ag.code}>
                        {ag.name} ({ag.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Approval Remarks / Gazette Citation (Optional)
                  </label>
                  <input
                    type="text"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="e.g. Gazette #2026/04 Statutory Appointment confirmed"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  disabled={approveMutation.isPending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={approveMutation.isPending}
                  onClick={() =>
                    approveMutation.mutate({
                      id: selectedRequest.id,
                      roleKey: targetRoleKey,
                      agencyCode: targetAgencyCode || undefined,
                      notes: approvalNotes,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Authorize &amp; Activate</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Rejection Modal */}
        {showRejectModal && selectedRequest ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-wider">
                <ShieldAlert className="h-4 w-4" />
                <span>Decline Registration Request</span>
              </div>

              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                Decline {selectedRequest.fullName}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Provide a reason for rejection. This explanation will be included in the notification email sent to the applicant.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason for Rejection *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Unverified official email domain; line ministry authorization could not be established."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={rejectMutation.isPending}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={rejectMutation.isPending || rejectionReason.trim().length < 3}
                  onClick={() =>
                    rejectMutation.mutate({
                      id: selectedRequest.id,
                      reason: rejectionReason,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-rose-700 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserX className="h-4 w-4" />
                  )}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}
