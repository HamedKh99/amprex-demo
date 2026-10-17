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

/** Case group: batteries fit vehicles of the same group (L1 small, L2 medium, L3 large). */
type Group = 'L1' | 'L2' | 'L3' | 'YTX9' | 'YB7';

export const VEHICLE_MODELS: ReadonlyArray<{
  code: string;
  type: 'CAR' | 'MOTORCYCLE';
  make: string;
  brandFa: string;
  model: string;
  nameFa: string;
  factoryAh: number;
  groupSize: Group;
  yearFrom: number;
  yearTo: number | null;
}> = [
  { code: 'P206', type: 'CAR', make: 'IKCO', brandFa: 'ایران‌خودرو', model: '206 Type 2', nameFa: 'پژو ۲۰۶ تیپ ۲', factoryAh: 60, groupSize: 'L2', yearFrom: 2001, yearTo: null },
  { code: 'P405', type: 'CAR', make: 'IKCO', brandFa: 'ایران‌خودرو', model: '405', nameFa: 'پژو ۴۰۵', factoryAh: 60, groupSize: 'L2', yearFrom: 1991, yearTo: 2020 },
  { code: 'PARS', type: 'CAR', make: 'IKCO', brandFa: 'ایران‌خودرو', model: 'Pars', nameFa: 'پژو پارس', factoryAh: 60, groupSize: 'L2', yearFrom: 1999, yearTo: null },
  { code: 'SAMAND', type: 'CAR', make: 'IKCO', brandFa: 'ایران‌خودرو', model: 'Samand LX', nameFa: 'سمند LX', factoryAh: 60, groupSize: 'L2', yearFrom: 2002, yearTo: null },
  { code: 'DENA', type: 'CAR', make: 'IKCO', brandFa: 'ایران‌خودرو', model: 'Dena Plus', nameFa: 'دنا پلاس', factoryAh: 66, groupSize: 'L2', yearFrom: 2014, yearTo: null },
  { code: 'TIBA', type: 'CAR', make: 'Saipa', brandFa: 'سایپا', model: 'Tiba', nameFa: 'تیبا', factoryAh: 50, groupSize: 'L1', yearFrom: 2009, yearTo: null },
  { code: 'QUICK', type: 'CAR', make: 'Saipa', brandFa: 'سایپا', model: 'Quick', nameFa: 'کوییک', factoryAh: 50, groupSize: 'L1', yearFrom: 2017, yearTo: null },
  { code: 'SHAHIN', type: 'CAR', make: 'Saipa', brandFa: 'سایپا', model: 'Shahin', nameFa: 'سایپا شاهین', factoryAh: 60, groupSize: 'L2', yearFrom: 2020, yearTo: null },
  { code: 'L90', type: 'CAR', make: 'Renault', brandFa: 'رنو', model: 'Tondar 90', nameFa: 'رنو تندر ۹۰', factoryAh: 60, groupSize: 'L2', yearFrom: 2007, yearTo: 2018 },
  { code: 'CERATO', type: 'CAR', make: 'Kia', brandFa: 'کیا', model: 'Cerato', nameFa: 'کیا سراتو', factoryAh: 74, groupSize: 'L3', yearFrom: 2014, yearTo: null },
  // Motorcycles: no motorcycle batteries are stocked yet, which shows the «باتری سازگاری موجود نیست» state.
  { code: 'CBR250', type: 'MOTORCYCLE', make: 'Honda', brandFa: 'هوندا', model: 'CBR 250', nameFa: 'هوندا CBR ۲۵۰', factoryAh: 9, groupSize: 'YTX9', yearFrom: 2011, yearTo: null },
  { code: 'YBR125', type: 'MOTORCYCLE', make: 'Yamaha', brandFa: 'یاماها', model: 'YBR 125', nameFa: 'یاماها YBR ۱۲۵', factoryAh: 7, groupSize: 'YB7', yearFrom: 2005, yearTo: null },
];

export const BATTERIES: ReadonlyArray<{
  sku: string;
  brand: string;
  series: string;
  nameFa: string;
  capacityAh: number;
  coldCrankingA: number;
  groupSize: Group;
  warrantyMonths: number;
  priceRial: bigint;
  costRial: bigint;
}> = [
  { sku: 'SAB-50', brand: 'صبا باتری', series: 'SMF · سیلد', nameFa: 'صبا باتری ۵۰ آمپر', capacityAh: 50, coldCrankingA: 420, groupSize: 'L1', warrantyMonths: 12, priceRial: 42_000_000n, costRial: 30_500_000n },
  { sku: 'NIR-55', brand: 'نیرو', series: 'اقتصادی', nameFa: 'نیرو ۵۵ آمپر', capacityAh: 55, coldCrankingA: 450, groupSize: 'L1', warrantyMonths: 12, priceRial: 41_000_000n, costRial: 30_000_000n },
  { sku: 'SAB-60', brand: 'صبا باتری', series: 'SMF · سیلد', nameFa: 'صبا باتری ۶۰ آمپر', capacityAh: 60, coldCrankingA: 540, groupSize: 'L2', warrantyMonths: 18, priceRial: 48_500_000n, costRial: 35_500_000n },
  { sku: 'NIR-66', brand: 'نیرو', series: 'سیلد', nameFa: 'نیرو ۶۶ آمپر', capacityAh: 66, coldCrankingA: 600, groupSize: 'L2', warrantyMonths: 18, priceRial: 54_000_000n, costRial: 39_500_000n },
  { sku: 'ATL-60', brand: 'اطلس', series: 'BX · کره', nameFa: 'اطلس BX ۶۰ آمپر', capacityAh: 60, coldCrankingA: 550, groupSize: 'L2', warrantyMonths: 24, priceRial: 62_000_000n, costRial: 45_500_000n },
  { sku: 'SAB-74', brand: 'صبا باتری', series: 'SMF · سیلد', nameFa: 'صبا باتری ۷۴ آمپر', capacityAh: 74, coldCrankingA: 640, groupSize: 'L3', warrantyMonths: 18, priceRial: 59_500_000n, costRial: 43_500_000n },
  { sku: 'ATL-74', brand: 'اطلس', series: 'BX · کره', nameFa: 'اطلس BX ۷۴ آمپر', capacityAh: 74, coldCrankingA: 680, groupSize: 'L3', warrantyMonths: 24, priceRial: 72_000_000n, costRial: 52_500_000n },
  { sku: 'VAR-70', brand: 'وارتا', series: 'Blue Dynamic · آلمان', nameFa: 'وارتا ۷۰ آمپر', capacityAh: 70, coldCrankingA: 640, groupSize: 'L3', warrantyMonths: 24, priceRial: 80_000_000n, costRial: 59_000_000n },
];

/** Free stock (onHand − reserved) per branch after seeding. 0 = demo OUT_OF_STOCK case. */
export const FREE_STOCK: Record<BranchCode, Record<string, number>> = {
  WEST: { 'SAB-50': 12, 'NIR-55': 6, 'SAB-60': 14, 'NIR-66': 5, 'ATL-60': 4, 'SAB-74': 6, 'ATL-74': 3, 'VAR-70': 2 },
  EAST: { 'SAB-50': 9, 'NIR-55': 4, 'SAB-60': 10, 'NIR-66': 3, 'ATL-60': 2, 'SAB-74': 5, 'ATL-74': 0, 'VAR-70': 1 },
};

/** Zones are a subset of the branch's districts; capacity = jobs per day. */
export const TECHNICIANS: ReadonlyArray<{
  branch: BranchCode;
  fullName: string;
  phone: string;
  serviceDistricts: number[];
  dailyCapacity: number;
  demoUser?: boolean;
}> = [
  { branch: 'WEST', fullName: 'رضا کریمی', phone: '09121110001', serviceDistricts: [2, 5, 6, 10], dailyCapacity: 6, demoUser: true },
  { branch: 'WEST', fullName: 'مهدی رستمی', phone: '09121110002', serviceDistricts: [6, 9, 11, 17, 18, 21, 22], dailyCapacity: 6 },
  { branch: 'EAST', fullName: 'علی نوروزی', phone: '09121110003', serviceDistricts: [1, 3, 4, 7, 8, 12], dailyCapacity: 6 },
  { branch: 'EAST', fullName: 'حسین قاسمی', phone: '09121110004', serviceDistricts: [3, 13, 14, 15, 16, 19, 20], dailyCapacity: 6 },
];

/** weight = relative share among seeded orders. */
export const CHANNELS = [
  { code: 'WEBSITE', nameFa: 'وب‌سایت', weight: 30 },
  { code: 'PHONE', nameFa: 'تلفنی', weight: 30 },
  { code: 'INSTAGRAM', nameFa: 'اینستاگرام', weight: 15 },
  { code: 'WHATSAPP', nameFa: 'واتس‌اپ', weight: 10 },
  { code: 'DIVAR', nameFa: 'دیوار', weight: 8 },
  { code: 'REFERRAL', nameFa: 'همکار', weight: 7 },
] as const;

/** Capacity = jobs per branch per slot per day (design: «۱ از ۶ تکمیل»). */
export const SLOTS = [
  { code: 'MORNING', label: 'صبح', startTime: '08:00', endTime: '11:00', capacity: 6 },
  { code: 'NOON', label: 'ظهر', startTime: '11:00', endTime: '14:00', capacity: 6 },
  { code: 'AFTERNOON', label: 'عصر', startTime: '14:00', endTime: '17:00', capacity: 6 },
  { code: 'EVENING', label: 'شب', startTime: '17:00', endTime: '20:00', capacity: 6 },
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
export const BRANCH_NOTES = [
  'قبل از حرکت تماس گرفته شود.',
  'مشتری بعد از ساعت ۱۷ در دسترس است.',
  'پارکینگ طبقه منفی یک، زنگ واحد ۴.',
];

export const STREETS = [
  'خیابان آزادی', 'خیابان شریعتی', 'بلوار کشاورز', 'خیابان ولیعصر', 'خیابان پیروزی',
  'بزرگراه رسالت', 'خیابان دماوند', 'خیابان جمهوری', 'خیابان فاطمی', 'بلوار فردوس',
  'خیابان پاسداران', 'خیابان هنگام', 'خیابان نیروی هوایی', 'خیابان کارگر شمالی',
];
