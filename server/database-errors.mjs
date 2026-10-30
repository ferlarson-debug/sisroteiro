// Public diagnostics are a fixed allowlist: never expose driver messages or URLs.
export function configError(code, message) {
  return Object.assign(new Error(message), { code });
}
const configurationCodes = new Set([
  "DATABASE_URL_MISSING",
  "DATABASE_URL_INVALID",
  "DATABASE_PROTOCOL_INVALID",
  "DATABASE_ADDRESS_INVALID",
]);
export function databaseDiagnostic(error) {
  if (configurationCodes.has(error?.code)) return error.code;
  const code = error?.code || error?.cause?.code;
  if (
    [
      "28P01",
      "28000",
      "ER_ACCESS_DENIED_ERROR",
      "ER_DBACCESS_DENIED_ERROR",
    ].includes(code)
  )
    return "DATABASE_AUTH_FAILED";
  if (["42P01", "3F000", "ER_NO_SUCH_TABLE"].includes(code))
    return "DATABASE_SCHEMA_MISSING";
  if (["3D000", "ER_BAD_DB_ERROR"].includes(code)) return "DATABASE_NOT_FOUND";
  if (
    [
      "SELF_SIGNED_CERT_IN_CHAIN",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
      "CERT_HAS_EXPIRED",
      "ERR_TLS_CERT_ALTNAME_INVALID",
    ].includes(code)
  )
    return "DATABASE_TLS_FAILED";
  if (
    [
      "ECONNREFUSED",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ETIMEDOUT",
      "ECONNRESET",
      "53300",
      "57P01",
      "ER_CON_COUNT_ERROR",
    ].includes(code)
  )
    return "DATABASE_UNREACHABLE";
  return null;
}
