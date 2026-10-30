import {
  requireSchoolMembership,
  type SchoolAuthorization,
} from "./authorization";

type RequestHeaders = Headers | HeadersInit;

export type SchoolContext = SchoolAuthorization;

export async function requireSchoolContext(
  headers: RequestHeaders,
  schoolId: string,
): Promise<SchoolContext> {
  return requireSchoolMembership(headers, schoolId);
}
