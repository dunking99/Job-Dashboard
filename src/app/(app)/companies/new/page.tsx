import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CompanyForm } from "@/components/CompanyForm";
import { saveCompany } from "@/app/actions/crm";

export default async function NewCompanyPage() {
  const domains = await prisma.domain.findMany({ orderBy: { name: "asc" } });

  async function create(formData: FormData) {
    "use server";
    return saveCompany(null, formData);
  }

  return (
    <>
      <PageHeader
        title="Add an organisation"
        description="Everything except the name is optional — the research dossier can be generated afterwards."
      />
      <CompanyForm company={null} domains={domains} action={create} />
    </>
  );
}
