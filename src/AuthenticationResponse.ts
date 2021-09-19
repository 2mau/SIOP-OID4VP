import { JWTHeader } from 'did-jwt';

import AuthenticationRequest from './AuthenticationRequest';
import { createDiscoveryMetadataPayload } from './AuthenticationResponseRegistration';
import { DIDJwt, DIDres, State } from './functions';
import { fetchDidDocument } from './functions/DIDResolution';
import { signDidJwtPayload, verifyDidJWT } from './functions/DidJWT';
import { getPublicJWKFromHexPrivateKey, getThumbprint, getThumbprintFromJwk } from './functions/Keys';
import { JWT, SIOP, SIOPErrors } from './types';
import {
  AuthenticationResponsePayload,
  VerifiedAuthenticationResponseWithJWT,
  VerifyAuthenticationResponseOpts,
} from './types/SIOP.types';

export default class AuthenticationResponse {
  /**
   * Creates a SIOP Response Object
   *
   * @param didAuthResponse
   */
  static async createJWTFromRequestJWT(
    requestJwt: string,
    responseOpts: SIOP.AuthenticationResponseOpts,
    verifyOpts: SIOP.VerifyAuthenticationRequestOpts
  ): Promise<SIOP.AuthenticationResponseWithJWT> {
    assertValidResponseOpts(responseOpts);
    const verifiedJWT = await AuthenticationRequest.verifyJWT(requestJwt, verifyOpts);
    return AuthenticationResponse.createJWTFromVerifiedRequest(verifiedJWT, responseOpts);
  }

  static async createJWTFromVerifiedRequest(
    verifiedJwt: SIOP.VerifiedAuthenticationRequestWithJWT,
    responseOpts: SIOP.AuthenticationResponseOpts
  ): Promise<SIOP.AuthenticationResponseWithJWT> {
    console.log(verifiedJwt);

    const payload = await createSIOPResponsePayload(verifiedJwt, responseOpts);
    const jwt = await signDidJwtPayload(payload, responseOpts);

    return {
      jwt,
      nonce: payload.nonce,
      state: payload.state,
      payload,
      responseOpts,
    };

    // todo add uri generation support in separate method, like in the AuthRequest class

    /*if (isInternalSignature(responseOpts.signatureType)) {
                            return DIDJwt.signDidJwtInternal(payload, ResponseIss.SELF_ISSUED_V2, responseOpts.signatureType.hexPrivateKey, responseOpts.signatureType.kid);
                        } else if (isExternalSignature(responseOpts.signatureType)) {
                            return DIDJwt.signDidJwtExternal(payload, responseOpts.signatureType.signatureUri, responseOpts.signatureType.authZToken, responseOpts.signatureType.kid);
                        } else {
                            throw new Error("INVALID_SIGNATURE_TYPE");
                        }*/
    /*const params = `id_token=${JWT}`;
                        const uriResponse = {
                            encodedUri: "",
                            bodyEncoded: "",
                            encodingFormat: SIOP.UrlEncodingFormat.FORM_URL_ENCODED,
                            responseMode: didAuthResponseCall.responseMode
                                ? didAuthResponseCall.responseMode
                                : SIOP.ResponseMode.FRAGMENT, // FRAGMENT is the default
                        };

                        if (didAuthResponseCall.responseMode === SIOP.ResponseMode.FORM_POST) {
                            uriResponse.encodedUri = encodeURI(didAuthResponseCall.redirectUri);
                            uriResponse.bodyEncoded = encodeURI(params);
                        } else if (didAuthResponseCall.responseMode === SIOP.ResponseMode.QUERY) {
                            uriResponse.encodedUri = encodeURI(`${didAuthResponseCall.redirectUri}?${params}`);
                        } else {
                            uriResponse.responseMode = SIOP.ResponseMode.FRAGMENT;
                            uriResponse.encodedUri = encodeURI(`${didAuthResponseCall.redirectUri}#${params}`);
                        }
                        return uriResponse;*/
  }

  /**
   * Verifies a SIOP ID Response JWT on the RP Side
   *
   * @param jwt ID token to be validated
   * @param audience expected audience
   */
  static async verifyJWT(
    jwt: string,
    verifyOpts: VerifyAuthenticationResponseOpts
  ): Promise<VerifiedAuthenticationResponseWithJWT> {
    if (!jwt) {
      throw new Error(SIOPErrors.NO_JWT);
    }
    //todo assert valid method for opts

    const { header, payload } = DIDJwt.parseJWT(jwt);
    assertValidResponseJWT(header, payload);

    //todo: check options audience against audience from jwt

    const verifiedJWT = await verifyDidJWT(jwt, DIDres.getResolver(verifyOpts.verification.resolveOpts), {
      audience: verifyOpts.audience,
    });

    const issuerDid = DIDJwt.getIssuerDidFromPayload(payload);

    if (!verifiedJWT || !verifiedJWT.payload) {
      throw Error(SIOPErrors.ERROR_VERIFYING_SIGNATURE);
    } else if (!verifiedJWT.payload.nonce) {
      throw Error(SIOPErrors.NO_NONCE);
    }

    return {
      signer: verifiedJWT.signer,
      didResolutionResult: verifiedJWT.didResolutionResult,
      jwt,
      verifyOpts,
      issuer: issuerDid,
      payload: {
        ...(verifiedJWT.payload as AuthenticationResponsePayload),
      },
    };
  }
}

function assertValidResponseJWT(header: JWTHeader, payload: JWT.JWTPayload) {
  console.log(header);
  if (payload.iss !== SIOP.ResponseIss.SELF_ISSUED_V2) {
    throw new Error(SIOPErrors.NO_SELFISSUED_ISS);
  }
}

async function createThumbprintAndJWK(resOpts: SIOP.AuthenticationResponseOpts) {
  let thumbprint;
  let subJwk;
  if (SIOP.isInternalSignature(resOpts.signatureType)) {
    thumbprint = getThumbprint(resOpts.signatureType.hexPrivateKey, resOpts.did);
    subJwk = getPublicJWKFromHexPrivateKey(
      resOpts.signatureType.hexPrivateKey,
      resOpts.signatureType.kid || `${resOpts.signatureType.did}#key-1`,
      resOpts.did
    );
  } else if (SIOP.isExternalSignature(resOpts.signatureType)) {
    const didDocument = await fetchDidDocument(resOpts.registration.registrationBy.referenceUri);
    thumbprint = getThumbprintFromJwk(didDocument.verificationMethod[0].publicKeyJwk, resOpts.did);
    subJwk = didDocument.verificationMethod[0].publicKeyJwk;
  } else {
    throw new Error(SIOPErrors.SIGNATURE_OBJECT_TYPE_NOT_SET);
  }
  return { thumbprint, subJwk };
}

async function createSIOPResponsePayload(
  verifiedJwt: SIOP.VerifiedAuthenticationRequestWithJWT,
  resOpts: SIOP.AuthenticationResponseOpts
): Promise<SIOP.AuthenticationResponsePayload> {
  assertValidResponseOpts(resOpts);
  if (!verifiedJwt || !verifiedJwt.jwt) {
    throw new Error(SIOPErrors.VERIFY_BAD_PARAMS);
  }

  const { thumbprint, subJwk } = await createThumbprintAndJWK(resOpts);
  const state = State.getState(verifiedJwt.payload.state);
  const nonce = State.getNonce(state, resOpts.nonce);
  const registration = createDiscoveryMetadataPayload(resOpts.registration);
  return {
    iss: SIOP.ResponseIss.SELF_ISSUED_V2,
    sub: thumbprint,
    aud: verifiedJwt.payload.redirect_uri,
    did: resOpts.did,
    sub_jwk: subJwk,
    state,
    nonce,
    iat: Date.now(),
    exp: Date.now() + (resOpts.expiresIn || 600),
    registration,
    vp: resOpts.vp,
  };
}

function assertValidResponseOpts(opts: SIOP.AuthenticationResponseOpts) {
  if (!opts /*|| !opts.redirectUri*/ || !opts.signatureType /*|| !opts.nonce*/ || !opts.did) {
    throw new Error(SIOPErrors.BAD_PARAMS);
  } else if (!(SIOP.isInternalSignature(opts.signatureType) || SIOP.isExternalSignature(opts.signatureType))) {
    throw new Error(SIOPErrors.SIGNATURE_OBJECT_TYPE_NOT_SET);
  }
}
