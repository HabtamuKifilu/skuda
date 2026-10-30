import { PublicCareersPage } from "@/components/public/public-careers-page";

type PageProps = {
  params: Promise<{ schoolSlug: string }>;
};

export default async function CareersPage({ params }: PageProps) {
  const { schoolSlug } = await params;

  return <PublicCareersPage schoolSlug={schoolSlug} />;
}
