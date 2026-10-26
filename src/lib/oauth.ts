import { createHmac, randomBytes } from 'node:crypto';

/**
 * OAuth 1.0a HMAC-SHA256 for NetSuite Token-Based Authentication.
 * Ported from the read-only SuiteQL signer: realm is raw, every other
 * value is RFC 3986 percent-encoded, and the signature covers the POST
 * URL including limit/offset (not the JSON body).
 */
export function oauthEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export interface OAuthInput {
  method?: string;
  url: string;
  account: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  timestamp?: string;
  nonce?: string;
}

export function freshOAuthMaterial(): { timestamp: string; nonce: string } {
  return {
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: randomBytes(16).toString('hex'),
  };
}

export function createOAuthHeader(input: OAuthInput): string {
  if (!/^[\w-]+$/.test(input.account)) {
    throw new Error('NETSUITE_ACCOUNT_ID has unexpected characters.');
  }
  const material = {
    timestamp: input.timestamp ?? freshOAuthMaterial().timestamp,
    nonce: input.nonce ?? freshOAuthMaterial().nonce,
  };
  const method = (input.method ?? 'POST').toUpperCase();
  const oauth: Record<string, string> = {
    oauth_consumer_key: input.consumerKey,
    oauth_token: input.tokenId,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: material.timestamp,
    oauth_nonce: material.nonce,
    oauth_version: '1.0',
  };
  const pairs = [...queryPairs(input.url), ...Object.entries(oauth)];
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const paramString = pairs.map(([key, value]) => `${oauthEncode(key)}=${oauthEncode(value)}`).join('&');
  const baseUrl = input.url.split('?')[0] ?? input.url;
  const baseString = [method, oauthEncode(baseUrl), oauthEncode(paramString)].join('&');
  const key = `${oauthEncode(input.consumerSecret)}&${oauthEncode(input.tokenSecret)}`;
  const signature = createHmac('sha256', key).update(baseString).digest('base64');
  const ordered: Array<[string, string]> = [
    ['oauth_consumer_key', input.consumerKey],
    ['oauth_token', input.tokenId],
    ['oauth_signature_method', 'HMAC-SHA256'],
    ['oauth_timestamp', material.timestamp],
    ['oauth_nonce', material.nonce],
    ['oauth_version', '1.0'],
    ['oauth_signature', signature],
  ];
  const parts = ordered.map(([keyName, value]) => `${keyName}="${oauthEncode(value)}"`);
  return `OAuth realm="${input.account}", ${parts.join(', ')}`;
}

function queryPairs(url: string): Array<[string, string]> {
  const query = url.split('?')[1];
  if (!query) return [];
  return query.split('&').filter(Boolean).map((part) => {
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? '' : part.slice(eq + 1);
    return [decodeURIComponent(rawKey), decodeURIComponent(rawValue)];
  });
}
