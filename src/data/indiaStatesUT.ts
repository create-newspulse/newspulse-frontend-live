export type IndiaStateOrUT = {
  name: string;
  slug: string;
  type: 'state' | 'ut';
};

// India States & Union Territories (static list)
// Slugs are kebab-case and intended to match backend `:stateSlug`.
export const INDIA_STATES_UT: IndiaStateOrUT[] = [
  // States
  { name: 'Andhra Pradesh', slug: 'andhra-pradesh', type: 'state' },
  { name: 'Arunachal Pradesh', slug: 'arunachal-pradesh', type: 'state' },
  { name: 'Assam', slug: 'assam', type: 'state' },
  { name: 'Bihar', slug: 'bihar', type: 'state' },
  { name: 'Chhattisgarh', slug: 'chhattisgarh', type: 'state' },
  { name: 'Goa', slug: 'goa', type: 'state' },
  { name: 'Gujarat', slug: 'gujarat', type: 'state' },
  { name: 'Haryana', slug: 'haryana', type: 'state' },
  { name: 'Himachal Pradesh', slug: 'himachal-pradesh', type: 'state' },
  { name: 'Jharkhand', slug: 'jharkhand', type: 'state' },
  { name: 'Karnataka', slug: 'karnataka', type: 'state' },
  { name: 'Kerala', slug: 'kerala', type: 'state' },
  { name: 'Madhya Pradesh', slug: 'madhya-pradesh', type: 'state' },
  { name: 'Maharashtra', slug: 'maharashtra', type: 'state' },
  { name: 'Manipur', slug: 'manipur', type: 'state' },
  { name: 'Meghalaya', slug: 'meghalaya', type: 'state' },
  { name: 'Mizoram', slug: 'mizoram', type: 'state' },
  { name: 'Nagaland', slug: 'nagaland', type: 'state' },
  { name: 'Odisha', slug: 'odisha', type: 'state' },
  { name: 'Punjab', slug: 'punjab', type: 'state' },
  { name: 'Rajasthan', slug: 'rajasthan', type: 'state' },
  { name: 'Sikkim', slug: 'sikkim', type: 'state' },
  { name: 'Tamil Nadu', slug: 'tamil-nadu', type: 'state' },
  { name: 'Telangana', slug: 'telangana', type: 'state' },
  { name: 'Tripura', slug: 'tripura', type: 'state' },
  { name: 'Uttar Pradesh', slug: 'uttar-pradesh', type: 'state' },
  { name: 'Uttarakhand', slug: 'uttarakhand', type: 'state' },
  { name: 'West Bengal', slug: 'west-bengal', type: 'state' },

  // Union Territories
  { name: 'Andaman and Nicobar Islands', slug: 'andaman-and-nicobar-islands', type: 'ut' },
  { name: 'Chandigarh', slug: 'chandigarh', type: 'ut' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', slug: 'dadra-and-nagar-haveli-and-daman-and-diu', type: 'ut' },
  { name: 'Delhi', slug: 'delhi', type: 'ut' },
  { name: 'Jammu and Kashmir', slug: 'jammu-and-kashmir', type: 'ut' },
  { name: 'Ladakh', slug: 'ladakh', type: 'ut' },
  { name: 'Lakshadweep', slug: 'lakshadweep', type: 'ut' },
  { name: 'Puducherry', slug: 'puducherry', type: 'ut' },
];

export function findIndiaStateOrUTBySlug(slug: string | null | undefined): IndiaStateOrUT | null {
  const s = String(slug || '').toLowerCase().trim();
  if (!s) return null;
  return INDIA_STATES_UT.find((x) => x.slug === s) || null;
}
