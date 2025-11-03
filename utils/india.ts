export type Region = {
  name: string;
  slug: string;
  type: 'state' | 'ut';
  capital?: string; // Optional display-only capital/city label
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\((.*?)\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Custom order per product requirement (State → Capital)
const STATE_ORDER_WITH_CAPITALS: Array<[string, string]> = [
  ['Maharashtra', 'Mumbai'],
  ['Delhi', 'New Delhi'], // Kept here for order reference; handled under UTs below
  ['Karnataka', 'Bengaluru'],
  ['Tamil Nadu', 'Chennai'],
  ['West Bengal', 'Kolkata'],
  ['Telangana', 'Hyderabad'],
  ['Gujarat', 'Ahmedabad'],
  ['Rajasthan', 'Jaipur'],
  ['Uttar Pradesh', 'Lucknow'],
  ['Madhya Pradesh', 'Bhopal'],
  ['Punjab', 'Amritsar'],
  ['Kerala', 'Thiruvananthapuram'],
  ['Andhra Pradesh', 'Visakhapatnam'],
  ['Odisha', 'Bhubaneswar'],
  ['Goa', 'Panaji'],
  ['Assam', 'Guwahati'],
  ['Bihar', 'Patna'],
  ['Himachal Pradesh', 'Shimla'],
  ['Uttarakhand', 'Dehradun'],
  ['Jharkhand', 'Jamshedpur'],
  ['Sikkim', 'Gangtok'],
  ['Arunachal Pradesh', 'Itanagar'],
  ['Meghalaya', 'Shillong'],
  ['Nagaland', 'Kohima'],
  ['Manipur', 'Imphal'],
  ['Mizoram', 'Aizawl'],
  ['Tripura', 'Agartala'],
  ['Chhattisgarh', 'Raipur'],
  ['Haryana', 'Faridabad'],
  // User list ended with Jammu and Kashmir (UT); states list ends here
];

export const STATES: Region[] = STATE_ORDER_WITH_CAPITALS
  .filter(([name]) => name !== 'Delhi') // ensure Delhi appears only in UTs section
  .map(([name, capital]) => ({ name, slug: slugify(name), type: 'state', capital }));

export const UNION_TERRITORIES: Region[] = [
  { name: 'Delhi', capital: 'New Delhi' },
  { name: 'Jammu and Kashmir', capital: 'Srinagar' },
  { name: 'Andaman and Nicobar Islands', capital: 'Port Blair' },
  { name: 'Chandigarh', capital: 'Chandigarh' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', capital: 'Daman' },
  { name: 'Ladakh', capital: 'Leh' },
  { name: 'Lakshadweep', capital: 'Kavaratti' },
  { name: 'Puducherry', capital: 'Puducherry' }
].map(({ name, capital }) => ({ name, slug: slugify(name), type: 'ut', capital }));

export const ALL_REGIONS: Region[] = [...STATES, ...UNION_TERRITORIES];
