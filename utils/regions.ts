export type District = {
  name: string;
  slug: string;
};

type DistrictSeed = string | District;

function districtFromSeed(seed: DistrictSeed): District {
  if (typeof seed !== 'string') return seed;
  return {
    name: seed,
    slug: seed.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
  };
}

export const GUJARAT_DISTRICTS: District[] = [
  'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha',
  { name: 'Vav-Tharad', slug: 'vav-tharad' },
  'Bharuch', 'Bhavnagar', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka',
  'Gandhinagar', 'Gir Somnath', 'Jamnagar', 'Junagadh', 'Kheda', 'Kutch',
  'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
  'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar',
  'Tapi', 'Vadodara', 'Valsad'
].map(districtFromSeed);

export const STATES = [
  { key: 'gujarat', name: 'Gujarat', districts: GUJARAT_DISTRICTS }
];
