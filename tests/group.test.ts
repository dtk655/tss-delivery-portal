import { describe, expect, it } from 'vitest';
import { groupLines, isHeavyItem, shouldKeepLine } from '../src/lib/group';
import type { FulfillmentLine } from '../src/lib/types';

function line(over: Partial<FulfillmentLine> = {}): FulfillmentLine {
  return {
    so: 'SO1',
    customer: '100 Jefco Inc',
    memo: '',
    ifnum: 'IF1',
    ifdate: '2026-10-23',
    item: 'SIGN24X18',
    itemtype: 'InvtPart',
    kitcomponent: 'F',
    quantity: -2,
    quantityshiprecv: 0,
    loc: 'Hadley',
    addr1: '2 Petunia Dr',
    addr2: '',
    addressee: 'Jefco Inc',
    attention: '',
    addrphone: '',
    city: 'NORTH BRUNSWICK',
    state: 'NJ',
    zip: '08902',
    shipmethod: '517',
    ...over,
  };
}

describe('group', () => {
  it('drops kit components and shipping lines', () => {
    expect(shouldKeepLine(line())).toBe(true);
    expect(shouldKeepLine(line({ itemtype: 'ShipItem', item: 'Shipping' }))).toBe(false);
    expect(shouldKeepLine(line({ kitcomponent: 'T' }))).toBe(false);
    expect(shouldKeepLine(line({ itemtype: 'Kit', item: 'SIGNKIT' }))).toBe(true);
    expect(isHeavyItem('CRASHGARDWITHLIDINSERT')).toBe(true);
    expect(isHeavyItem('GRACO25U678')).toBe(true);
    expect(isHeavyItem('WINDMASTER4860K-2')).toBe(false);
    expect(isHeavyItem('SCORPPART10516')).toBe(false);
  });

  it('merges the two Port Authority records at 777 Jersey Ave', () => {
    const stops = groupLines([
      line({
        so: 'SO9127',
        ifnum: 'IF7308',
        customer: '2743 Port Authority Of NY/NJ',
        item: 'SCORPPART10516',
        quantity: -4,
        addr1: '777 Jersey Avenue',
        addressee: 'Port Authority Of NY/NJ',
        attention: 'Bassim Megaly',
        addrphone: '(201) 386-6825',
        city: 'JERSEY CITY',
        zip: '07310',
        loc: 'Hollywood',
      }),
      line({
        so: 'SO9236',
        ifnum: 'IF7385',
        customer: '2741 Port Authority Of NY & NJ',
        item: 'SCORPPART10550-01',
        quantity: -6,
        addr1: '777 Jersey Avenue Stockroom',
        addressee: 'Port Authority Of NY & NJ',
        city: 'JERSEY CITY',
        zip: '07310',
        loc: 'Hollywood',
      }),
    ]);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.customers).toEqual(['Port Authority Of NY & NJ', 'Port Authority Of NY/NJ']);
    expect(stops[0]?.sos).toEqual(['SO9127', 'SO9236']);
    expect(stops[0]?.items).toEqual(['[SO9127] SCORPPART10516 x4', '[SO9236] SCORPPART10550-01 x6']);
    expect(stops[0]?.notes).toEqual(['Attn Bassim Megaly (201) 386-6825']);
    expect(stops[0]?.town).toBe('Jersey City, NJ');
  });
});
