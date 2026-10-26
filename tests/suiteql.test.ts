import { describe, expect, it } from 'vitest';
import {
  assertReadOnlySql,
  assertSuiteQlUrl,
  NsError,
  netsuiteQueryUrl,
  readySql,
} from '../src/lib/suiteql';

describe('suiteql', () => {
  it('selects packed TSS Delivery Fleet orders and refuses writes', () => {
    const sql = readySql(true);
    expect(sql).toMatch(/shipmethod = 517/);
    expect(sql).toMatch(/ItemShip:B/);
    expect(sql).toMatch(/kitcomponent/);
    expect(readySql(false)).not.toMatch(/kitcomponent/);
    expect(() => assertReadOnlySql(sql)).not.toThrow();
    expect(() => assertReadOnlySql('DELETE FROM transaction')).toThrow(NsError);
    expect(() => assertReadOnlySql('SELECT 1; DELETE FROM transaction')).toThrow(NsError);
  });

  it('only allows the SuiteQL host', () => {
    expect(netsuiteQueryUrl('9787422_SB1', 1000, 0)).toBe(
      'https://9787422-sb1.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=1000&offset=0',
    );
    expect(() => assertSuiteQlUrl('https://evil.example/services/rest/query/v1/suiteql')).toThrow(NsError);
    expect(() =>
      assertSuiteQlUrl('https://9787422.suitetalk.api.netsuite.com/services/rest/record/v1/salesOrder'),
    ).toThrow(/SuiteQL/);
  });
});
