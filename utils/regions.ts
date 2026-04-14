export type District = {
  name: string;
  slug: string;
};

function toDistrictSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const GUJARAT_DISTRICTS: District[] = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch',
  'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
  'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
  'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
  'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
  'Tapi', 'Vadodara', 'Valsad', 'Vav-Tharad'
].map((name) => ({
  name,
  slug: toDistrictSlug(name)
}));

export const STATES = [
  { key: 'gujarat', name: 'Gujarat', districts: GUJARAT_DISTRICTS }
];
