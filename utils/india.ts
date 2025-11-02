export type Region = {
  name: string;
  slug: string;
  type: 'state' | 'ut';
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\((.*?)\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export const STATES: Region[] = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal'
].map(name => ({ name, slug: slugify(name), type: 'state' }));

export const UNION_TERRITORIES: Region[] = [
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
].map(name => ({ name, slug: slugify(name), type: 'ut' }));

export const ALL_REGIONS: Region[] = [...STATES, ...UNION_TERRITORIES];
