export type District = {
  name: string;
  slug: string;
};

export const GUJARAT_DISTRICTS: District[] = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
  'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
  'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
  'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
  'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
  'Tapi', 'Vadodara', 'Valsad'
].map((name) => ({
  name,
  slug: name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}));

export const STATES = [
  { key: 'gujarat', name: 'Gujarat', districts: GUJARAT_DISTRICTS }
];
