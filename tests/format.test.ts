import { describe, expect, it } from 'vitest';
import {
  addressKey,
  customerName,
  deliverByNote,
  displayQuantity,
  formatBoardDate,
  formatQty,
  nominalCrashgardLb,
  remainingQuantity,
  zonedDate,
} from '../src/lib/format';

describe('format', () => {
  it('drops the NetSuite entity number', () => {
    expect(customerName('2741 Port Authority Of NY & NJ')).toBe('Port Authority Of NY & NJ');
    expect(customerName('Jefco Inc')).toBe('Jefco Inc');
  });

  it('groups the stockroom line with the street address', () => {
    expect(addressKey('777 Jersey Avenue', '07310')).toBe(addressKey('777 Jersey Avenue Stockroom', '07310'));
    expect(addressKey('2 Petunia Dr', '08902')).not.toBe(addressKey('2 Petunia Dr', '07080'));
  });

  it('uses absolute packed quantity on fulfillment lines', () => {
    expect(displayQuantity(-4)).toBe(4);
    expect(formatQty(4)).toBe('4');
    expect(remainingQuantity(-10, 4)).toBe(6);
  });

  it('reads the deliver-before note and Crashgard weight', () => {
    expect(deliverByNote('IMTT Plant, **Deliver before 2:30PM**, Bayonne')).toBe('2:30PM');
    const pounds = nominalCrashgardLb([
      '[SO9225] CRASHGARDFILLED400 x1',
      '[SO9225] CRASHGARDFILLED700 x1',
      '[SO9225] CRASHGARDFILLED1400 x7',
      '[SO9225] CRASHGARDFILLED2100 x2',
    ]);
    expect(pounds).toBe(15100);
  });

  it('places 7:00 AM Eastern on the October sample date', () => {
    expect(zonedDate('2026-10-23', 7, 0).toISOString()).toBe('2026-10-23T11:00:00.000Z');
    expect(formatBoardDate('2026-10-23')).toMatch(/Oct 23, 2026/);
  });
});
