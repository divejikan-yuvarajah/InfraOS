import { IssueDetailClient } from "@/components/issues/issue-detail-client";

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IssueDetailClient id={id} />;
}
