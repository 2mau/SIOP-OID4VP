import LanguageTagUtils from './LanguageTagUtils';
import { DiscoveryMetadataOpts, DiscoveryMetadataPayload, ResponseIss, ResponseType, Schema, Scope, SigningAlgo, SubjectType } from './types';

export function createDiscoveryMetadataPayload(opts: DiscoveryMetadataOpts): DiscoveryMetadataPayload {
  const discoveryMetadataPayload: DiscoveryMetadataPayload = {
    subject_syntax_types_supported: [],
    issuer: ResponseIss.SELF_ISSUED_V2,
    authorization_endpoint: opts.authorizationEndpoint || Schema.OPENID,
    token_endpoint: opts.tokenEndpoint,
    userinfo_endpoint: opts.userinfoEndpoint,
    jwks_uri: opts.jwksUri,
    registration_endpoint: opts.registrationEndpoint,
    response_types_supported: ResponseType.ID_TOKEN,
    response_modes_supported: opts.responseModesSupported,
    grant_types_supported: opts.grantTypesSupported,
    acr_values_supported: opts.acrValuesSupported,
    scopes_supported: opts?.scopesSupported || [Scope.OPENID],
    subject_types_supported: opts?.subjectTypesSupported || [SubjectType.PAIRWISE],
    id_token_signing_alg_values_supported: opts?.idTokenSigningAlgValuesSupported || [SigningAlgo.ES256K, SigningAlgo.EDDSA],
    id_token_encryption_alg_values_supported: opts.idTokenEncryptionAlgValuesSupported,
    id_token_encryption_enc_values_supported: opts.idTokenEncryptionEncValuesSupported,
    userinfo_signing_alg_values_supported: opts.userinfoSigningAlgValuesSupported,
    userinfo_encryption_alg_values_supported: opts.userinfoEncryptionAlgValuesSupported,
    userinfo_encryption_enc_values_supported: opts.userinfoEncryptionEncValuesSupported,
    request_object_signing_alg_values_supported: opts.requestObjectSigningAlgValuesSupported || [SigningAlgo.ES256K, SigningAlgo.EDDSA],
    request_object_encryption_alg_values_supported: opts.requestObjectEncryptionAlgValuesSupported,
    request_object_encryption_enc_values_supported: opts.requestObjectEncryptionEncValuesSupported,
    token_endpoint_auth_methods_supported: opts.tokenEndpointAuthMethodsSupported,
    token_endpoint_auth_signing_alg_values_supported: opts.tokenEndpointAuthSigningAlgValuesSupported,
    display_values_supported: opts.displayValuesSupported,
    claim_types_supported: opts.claimTypesSupported,
    claims_supported: opts.claimsSupported,
    service_documentation: opts.serviceDocumentation,
    claims_locales_supported: opts.claimsLocalesSupported,
    ui_locales_supported: opts.uiLocalesSupported,
    claims_parameter_supported: opts.claimsParameterSupported,
    request_parameter_supported: opts.requestParameterSupported,
    request_uri_parameter_supported: opts.requestUriParameterSupported,
    require_request_uri_registration: opts.requireRequestUriRegistration,
    op_policy_uri: opts.opPolicyUri,
    op_tos_uri: opts.opTosUri,
    id_token_types_supported: opts.idTokenTypesSupported,
    vp_formats: opts.vpFormats,
    client_name: opts.clientName,
    logo_uri: opts.logoUri,
    client_purpose: opts.clientPurpose,
  };

  const targetFieldNames = new Map<string, string>();
  targetFieldNames.set('clientName', 'client_name');
  targetFieldNames.set('clientPurpose', 'client_purpose');

  return {
    ...discoveryMetadataPayload,
    ...LanguageTagUtils.getLanguageTaggedPropertiesMapped(opts, targetFieldNames),
  };
}
