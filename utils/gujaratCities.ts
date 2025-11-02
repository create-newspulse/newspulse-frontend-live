export type MajorCity = {
  name: string;
  slug: string;
  status: 'current' | 'approved';
  linkType: 'district' | 'city';
  districtSlug?: string; // when linkType is district, navigate to district page
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const CURRENT = ['Ahmedabad','Surat','Vadodara','Rajkot','Bhavnagar','Jamnagar','Junagadh','Gandhinagar'];
const APPROVED = ['Navsari','Gandhidham','Morbi','Vapi','Anand','Nadiad','Mehsana','Porbandar','Surendranagar'];

// Cities that are also districts (we link to district pages directly)
const DISTRICT_LINK = new Set([
  'Ahmedabad','Surat','Vadodara','Rajkot','Bhavnagar','Jamnagar','Junagadh','Gandhinagar',
  'Navsari','Morbi','Anand','Mehsana','Porbandar','Surendranagar'
]);

export const GUJARAT_MAJOR_CITIES: MajorCity[] = [
  ...CURRENT.map((name) => ({
    name,
    slug: slugify(name),
    status: 'current' as const,
    linkType: DISTRICT_LINK.has(name) ? ('district' as const) : ('city' as const),
    districtSlug: DISTRICT_LINK.has(name) ? slugify(name) : undefined
  })),
  ...APPROVED.map((name) => ({
    name,
    slug: slugify(name),
    status: 'approved' as const,
    linkType: DISTRICT_LINK.has(name) ? ('district' as const) : ('city' as const),
    districtSlug: DISTRICT_LINK.has(name) ? slugify(name) : undefined
  }))
];
