// ============================================================================
// Seeded RNG — small mulberry32 PRNG so sample data is reproducible.
// ============================================================================
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function int(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Kitchen',
  'Books',
  'Toys',
  'Beauty',
  'Sports',
  'Grocery',
];

const STATUSES = ['Delivered', 'Shipped', 'Processing', 'Cancelled', 'Returned'];

const BASE_DATE = new Date('2025-01-01T00:00:00Z');

function dateStr(offsetDays: number): string {
  const d = new Date(BASE_DATE.getTime() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

interface RowData {
  order_id: string;
  customer_id: string;
  product_id: string;
  product_category: string;
  quantity: number;
  amount: number;
  order_date: string;
  status: string;
}

/** Generate `count` clean, reproducible order records. */
export function generateCleanData(count = 600, seed = 42): RowData[] {
  const rng = mulberry32(seed);
  const rows: RowData[] = [];
  for (let i = 0; i < count; i++) {
    const cat = pick(rng, CATEGORIES);
    const qty = int(rng, 1, 5);
    const unitPrice = +(rng() * 80 + 10).toFixed(2);
    const amount = +(unitPrice * qty).toFixed(2);
    rows.push({
      order_id: 'ORD-' + pad(i + 1, 5),
      customer_id: 'CUST-' + pad(int(rng, 1, 300), 4),
      product_id: 'PROD-' + pad(int(rng, 1, 120), 4),
      product_category: cat,
      quantity: qty,
      amount: amount,
      order_date: dateStr(int(rng, 0, 270)),
      status: pick(rng, STATUSES),
    });
  }
  return rows;
}

/**
 * Generate a deliberately corrupted dataset with controlled defects:
 * duplicates, missing values, invalid quantities, negative amounts,
 * malformed dates, unexpected status values.
 */
export function generateCorruptedData(count = 600, seed = 99): RowData[] {
  const base = generateCleanData(count, seed);

  const rng = mulberry32(seed + 1);

  // 15 duplicate order_ids (rows 10–19 duplicate rows 0–9)
  for (let i = 0; i < 10; i++) {
    base[10 + i] = { ...base[i] };
  }
  // 5 more duplicates near the end
  for (let i = 0; i < 5; i++) {
    base[count - 5 + i] = { ...base[100 + i] };
  }

  // 20 rows with missing customer_id
  for (let i = 0; i < 20; i++) {
    base[int(rng, 20, 580)].customer_id = '';
  }
  // 15 rows with missing amount
  for (let i = 0; i < 15; i++) {
    base[int(rng, 20, 580)].amount = null as unknown as number;
  }
  // 10 rows with invalid quantity (zero or negative)
  for (let i = 0; i < 10; i++) {
    base[int(rng, 20, 580)].quantity = pick(rng, [0, -1, -3]);
  }
  // 12 rows with negative or zero amount
  for (let i = 0; i < 12; i++) {
    base[int(rng, 20, 580)].amount = pick(rng, [-5.0, -25.5, 0]);
  }
  // 10 rows with malformed dates
  for (let i = 0; i < 10; i++) {
    base[int(rng, 20, 580)].order_date = pick(rng, [
      '2025-13-40',
      'not-a-date',
      '25/01/01',
      '',
    ]);
  }
  // 8 rows with unexpected status
  for (let i = 0; i < 8; i++) {
    base[int(rng, 20, 580)].status = pick(rng, ['PENDING', '??', 'shipd']);
  }
  // 5 rows with missing product_category
  for (let i = 0; i < 5; i++) {
    base[int(rng, 20, 580)].product_category = '';
  }
  // A few outliers: extremely high amounts (statistical anomalies, not errors)
  for (let i = 0; i < 4; i++) {
    base[int(rng, 20, 580)].amount = +(rng() * 5000 + 3000).toFixed(2);
  }

  return base;
}

export { CATEGORIES, STATUSES };
