/**
 * Demo master data. Everything here is an ASSUMPTION for the demo (see README → «فرضیات»):
 * brands, prices, compatibility and district coverage are illustrative, not real quotes.
 * Money is Rial (BigInt).
 */

export const BRANCHES = [
  {
    code: 'WEST',
    name: 'شعبه غرب — ستارخان',
    address: 'تهران، خیابان ستارخان، نرسیده به میدان کوثر، پلاک ۱۲۰',
    phone: '02166001200',
    serviceDistricts: [2, 5, 6, 9, 10, 11, 17, 18, 21, 22],
  },
  {
    code: 'EAST',
    name: 'شعبه شرق — تهرانپارس',
    address: 'تهران، تهرانپارس، خیابان جشنواره، پلاک ۴۵',
    phone: '02177001200',
    serviceDistricts: [1, 3, 4, 7, 8, 12, 13, 14, 15, 16, 19, 20],
  },
] as const;

export type BranchCode = (typeof BRANCHES)[number]['code'];

/** S = small (50–55Ah), M = medium (60–66Ah), L = large (70–74Ah). */
type SizeClass = 'S' | 'M' | 'L';

export const VEHICLE_MODELS: ReadonlyArray<{
  code: string;
  make: string;
  model: string;
  nameFa: string;
  yearFrom: number;
  yearTo: number | null;
  size: SizeClass;
}> = [
  { code: 'PRIDE_131', make: 'Saipa', model: 'Pride 131', nameFa: 'پراید ۱۳۱', yearFrom: 2010, yearTo: 2020, size: 'S' },
  { code: 'TIBA', make: 'Saipa', model: 'Tiba', nameFa: 'تیبا', yearFrom: 2009, yearTo: null, size: 'S' },
  { code: 'QUICK', make: 'Saipa', model: 'Quick', nameFa: 'کوییک', yearFrom: 2017, yearTo: null, size: 'S' },
  { code: 'SHAHIN', make: 'Saipa', model: 'Shahin', nameFa: 'شاهین', yearFrom: 2020, yearTo: null, size: 'M' },
  { code: 'P206', make: 'Peugeot', model: '206', nameFa: 'پژو ۲۰۶', yearFrom: 2001, yearTo: null, size: 'M' },
  { code: 'P207', make: 'Peugeot', model: '207i', nameFa: 'پژو ۲۰۷', yearFrom: 2011, yearTo: null, size: 'M' },
  { code: 'P405', make: 'Peugeot', model: '405', nameFa: 'پژو ۴۰۵', yearFrom: 1991, yearTo: 2020, size: 'M' },
  { code: 'PARS', make: 'IKCO', model: 'Pars', nameFa: 'پژو پارس', yearFrom: 1999, yearTo: null, size: 'M' },
  { code: 'SAMAND', make: 'IKCO', model: 'Samand', nameFa: 'سمند', yearFrom: 2002, yearTo: null, size: 'M' },
  { code: 'DENA', make: 'IKCO', model: 'Dena', nameFa: 'دنا', yearFrom: 2014, yearTo: null, size: 'M' },
  { code: 'L90', make: 'Renault', model: 'Tondar 90', nameFa: 'رنو تندر ۹۰', yearFrom: 2007, yearTo: 2018, size: 'M' },
  { code: 'CERATO', make: 'Kia', model: 'Cerato', nameFa: 'کیا سراتو', yearFrom: 2014, yearTo: null, size: 'L' },
];

export const BATTERIES: ReadonlyArray<{
  sku: string;
  brand: string;
  nameFa: string;
  capacityAh: number;
  coldCrankingA: number;
  groupSize: string;
  warrantyMonths: number;
  priceRial: bigint;
  coreCreditRial: bigint;
  size: SizeClass;
  /** Shown first for this size class. */
  recommended?: boolean;
}> = [
  { sku: 'SAB-50', brand: 'صبا باتری', nameFa: 'صبا باتری ۵۰ آمپر', capacityAh: 50, coldCrankingA: 420, groupSize: 'L1', warrantyMonths: 12, priceRial: 48_000_000n, coreCreditRial: 8_000_000n, size: 'S', recommended: true },
  { sku: 'NIR-55', brand: 'نیرو', nameFa: 'نیرو ۵۵ آمپر', capacityAh: 55, coldCrankingA: 450, groupSize: 'L1', warrantyMonths: 12, priceRial: 52_000_000n, coreCreditRial: 9_000_000n, size: 'S' },
  { sku: 'SAB-60', brand: 'صبا باتری', nameFa: 'صبا باتری ۶۰ آمپر', capacityAh: 60, coldCrankingA: 510, groupSize: 'L2', warrantyMonths: 15, priceRial: 58_000_000n, coreCreditRial: 10_000_000n, size: 'M', recommended: true },
  { sku: 'NIR-66', brand: 'نیرو', nameFa: 'نیرو ۶۶ آمپر', capacityAh: 66, coldCrankingA: 540, groupSize: 'L2', warrantyMonths: 15, priceRial: 64_000_000n, coreCreditRial: 11_000_000n, size: 'M' },
  { sku: 'ATL-60', brand: 'اطلس BX', nameFa: 'اطلس BX ۶۰ آمپر', capacityAh: 60, coldCrankingA: 550, groupSize: 'L2', warrantyMonths: 18, priceRial: 85_000_000n, coreCreditRial: 10_000_000n, size: 'M' },
  { sku: 'SAB-74', brand: 'صبا باتری', nameFa: 'صبا باتری ۷۴ آمپر', capacityAh: 74, coldCrankingA: 640, groupSize: 'L3', warrantyMonths: 15, priceRial: 72_000_000n, coreCreditRial: 12_000_000n, size: 'L' },
  { sku: 'ATL-74', brand: 'اطلس BX', nameFa: 'اطلس BX ۷۴ آمپر', capacityAh: 74, coldCrankingA: 680, groupSize: 'L3', warrantyMonths: 18, priceRial: 98_000_000n, coreCreditRial: 12_000_000n, size: 'L', recommended: true },
  { sku: 'VAR-70', brand: 'وارتا', nameFa: 'وارتا ۷۰ آمپر', capacityAh: 70, coldCrankingA: 640, groupSize: 'L3', warrantyMonths: 24, priceRial: 110_000_000n, coreCreditRial: 12_000_000n, size: 'L' },
];

/** Free stock (onHand − reserved) per branch after seeding. 0 = demo OUT_OF_STOCK case. */
export const FREE_STOCK: Record<BranchCode, Record<string, number>> = {
  WEST: { 'SAB-50': 12, 'NIR-55': 6, 'SAB-60': 14, 'NIR-66': 5, 'ATL-60': 4, 'SAB-74': 6, 'ATL-74': 3, 'VAR-70': 2 },
  EAST: { 'SAB-50': 9, 'NIR-55': 4, 'SAB-60': 10, 'NIR-66': 3, 'ATL-60': 2, 'SAB-74': 5, 'ATL-74': 0, 'VAR-70': 1 },
};

export const TECHNICIANS: ReadonlyArray<{ branch: BranchCode; fullName: string; phone: string; demoUser?: boolean }> = [
  { branch: 'WEST', fullName: 'رضا کریمی', phone: '09121110001', demoUser: true },
  { branch: 'WEST', fullName: 'مهدی رستمی', phone: '09121110002' },
  { branch: 'EAST', fullName: 'علی نوروزی', phone: '09121110003' },
  { branch: 'EAST', fullName: 'حسین قاسمی', phone: '09121110004' },
];

/** weight = relative share among seeded orders. */
export const CHANNELS = [
  { code: 'WEBSITE', nameFa: 'وب‌سایت', weight: 30 },
  { code: 'PHONE', nameFa: 'تماس تلفنی', weight: 30 },
  { code: 'INSTAGRAM', nameFa: 'اینستاگرام', weight: 15 },
  { code: 'WHATSAPP', nameFa: 'واتس‌اپ', weight: 10 },
  { code: 'DIVAR', nameFa: 'دیوار', weight: 8 },
  { code: 'REFERRAL', nameFa: 'معرفی تعمیرگاه', weight: 7 },
] as const;

/** Capacity = jobs per branch per slot per day (2 technicians per branch). */
export const SLOTS = [
  { code: 'MORNING', label: 'صبح', startTime: '08:00', endTime: '11:00', capacity: 2 },
  { code: 'NOON', label: 'ظهر', startTime: '11:00', endTime: '14:00', capacity: 2 },
  { code: 'AFTERNOON', label: 'عصر', startTime: '14:00', endTime: '17:00', capacity: 2 },
  { code: 'EVENING', label: 'شب', startTime: '17:00', endTime: '20:00', capacity: 2 },
] as const;

/** Phone numbers are fake (0912000xxxx). Password comes from SEED_DEMO_PASSWORD. */
export const DEMO_USERS = [
  { phone: '09120000001', fullName: 'مدیر سامانه', role: 'SUPER_ADMIN', branch: null },
  { phone: '09120000002', fullName: 'سارا محمدی', role: 'BRANCH_MANAGER', branch: 'WEST' },
  { phone: '09120000003', fullName: 'نرگس احمدی', role: 'OPERATOR', branch: 'WEST' },
  { phone: '09120000004', fullName: 'رضا کریمی', role: 'TECHNICIAN', branch: 'WEST' },
] as const;

export const CUSTOMER_FIRST_NAMES = [
  'محمد', 'علی', 'حسین', 'زهرا', 'فاطمه', 'مریم', 'امیر', 'سعید', 'نیلوفر', 'پریسا',
  'کامران', 'بهاره', 'مجید', 'الهام', 'فرهاد', 'شیرین', 'حمید', 'لیلا', 'بهرام', 'سمیرا',
];
export const CUSTOMER_LAST_NAMES = [
  'رضایی', 'حسینی', 'موسوی', 'جعفری', 'صادقی', 'کاظمی', 'مرادی', 'اکبری', 'یوسفی', 'عباسی',
  'شریفی', 'نجفی', 'طاهری', 'فرهادی', 'باقری',
];
export const STREETS = [
  'خیابان آزادی', 'خیابان شریعتی', 'بلوار کشاورز', 'خیابان ولیعصر', 'خیابان پیروزی',
  'بزرگراه رسالت', 'خیابان دماوند', 'خیابان جمهوری', 'خیابان فاطمی', 'بلوار فردوس',
  'خیابان پاسداران', 'خیابان هنگام', 'خیابان نیروی هوایی', 'خیابان کارگر شمالی',
];
