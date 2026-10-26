import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createOAuthHeader, oauthEncode } from '../src/lib/oauth';

describe('oauth', () => {
  it('percent-encodes like the Python TBA signer', () => {
    const sample = "a b*~!'()";
    const python = execFileSync(
      'python3',
      ['-c', 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe="~-._"))', sample],
      { encoding: 'utf8' },
    ).trim();
    expect(oauthEncode(sample)).toBe(python);
  });

  it('matches a Python HMAC-SHA256 signature', () => {
    const input = {
      url: 'https://9787422.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0',
      account: '9787422',
      consumerKey: 'ck',
      consumerSecret: 'cs+/',
      tokenId: 'tk',
      tokenSecret: 'ts&=',
      timestamp: '1761500000',
      nonce: 'abc123',
    };
    const header = createOAuthHeader(input);
    expect(header.startsWith('OAuth realm="9787422", ')).toBe(true);
    const encoded = header.match(/oauth_signature="([^"]+)"/)?.[1];
    expect(encoded).toBeTruthy();
    const signature = decodeURIComponent(encoded!);
    const python = execFileSync(
      'python3',
      [
        '-c',
        `
import urllib.parse, hmac, hashlib, base64
def pct(s):
    return urllib.parse.quote(str(s), safe="~-._")
url = ${JSON.stringify(input.url)}
base_url = url.split("?", 1)[0]
query = dict(urllib.parse.parse_qsl(url.split("?", 1)[1], keep_blank_values=True))
oauth = {
  "oauth_consumer_key": ${JSON.stringify(input.consumerKey)},
  "oauth_token": ${JSON.stringify(input.tokenId)},
  "oauth_signature_method": "HMAC-SHA256",
  "oauth_timestamp": ${JSON.stringify(input.timestamp)},
  "oauth_nonce": ${JSON.stringify(input.nonce)},
  "oauth_version": "1.0",
}
params = {**query, **oauth}
pstr = "&".join(f"{pct(k)}={pct(params[k])}" for k in sorted(params))
base = "&".join(["POST", pct(base_url), pct(pstr)])
key = f"{pct(${JSON.stringify(input.consumerSecret)})}&{pct(${JSON.stringify(input.tokenSecret)})}"
print(base64.b64encode(hmac.new(key.encode(), base.encode(), hashlib.sha256).digest()).decode())
`,
      ],
      { encoding: 'utf8' },
    ).trim();
    expect(signature).toBe(python);
  });
});
