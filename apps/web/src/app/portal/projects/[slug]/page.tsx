import { PortalProjectDetailClient } from "@/components/portal/portal-project-detail-client";

export default async function PublicProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PortalProjectDetailClient slug={slug} locale="en" />;
}
