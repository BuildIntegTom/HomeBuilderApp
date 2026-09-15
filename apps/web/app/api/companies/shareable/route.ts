import { NO_STORE, cloudErrorResponse, requireCloudSession } from "@/app/cloud/cloudRouteSession";
import { listShareableCompanies } from "@/app/cloud/sharingRouteLogic";

/**
 * GET /api/companies/shareable — the share form's company picker (Stage 3B).
 * `shareable_companies()`: consortium member companies, names and ids only
 * (Open Item 4). The picker leaves out the project's owner itself; the database
 * refuses it anyway (`owner-company`). No admin client.
 */
export async function GET() {
  try {
    const session = await requireCloudSession();
    const result = await listShareableCompanies(session.supabase);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
