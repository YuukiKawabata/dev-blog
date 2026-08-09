import crypto from 'node:crypto';

/**
 * RFC 3986 percent encoding. encodeURIComponent leaves !'()* alone, OAuth does not.
 */
function percentEncode(value) {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function compareEncoded(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] === b[1]) return 0;
  return a[1] < b[1] ? -1 : 1;
}

/**
 * Build an `Authorization: OAuth ...` header for a user-context request.
 *
 * Only query parameters take part in the signature. JSON and multipart bodies
 * are excluded by the spec, which is what both the Articles and the media
 * upload endpoints send.
 *
 * @param {object} params
 * @param {string} params.method HTTP method
 * @param {string} params.url Absolute URL without query string
 * @param {Record<string, string>} [params.queryParams]
 * @param {{apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string}} params.credentials
 * @param {string} [params.nonce] Fixed nonce — for tests only
 * @param {number} [params.timestamp] Fixed unix timestamp — for tests only
 */
export function buildAuthHeader({ method, url, queryParams = {}, credentials, nonce, timestamp }) {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = credentials;

  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce ?? crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const encodedPairs = Object.entries({ ...queryParams, ...oauthParams }).map(([key, value]) => [
    percentEncode(key),
    percentEncode(value),
  ]);

  const parameterString = encodedPairs
    .sort(compareEncoded)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(parameterString)].join('&');
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };

  const header = Object.keys(headerParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
    .join(', ');

  return `OAuth ${header}`;
}
