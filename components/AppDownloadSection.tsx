const categories = [
  'Politics',
  'Regional',
  'National',
  'International',
  'Business',
  'Glamorous',
  'Lifestyle',
  'Science',
  'Technology',
];

const AppDownloadSection = () => {
  return (
    <section className="py-12 bg-white">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
        Browse Categories
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 max-w-5xl mx-auto px-4">
        {categories.map((category, index) => (
          <div
            key={index}
            className="bg-gray-100 text-center p-4 rounded-lg font-semibold text-black hover:shadow-lg hover:scale-105 transition cursor-pointer"
          >
            {category}
          </div>
        ))}
      </div>
    </section>
  );
};

export default AppDownloadSection;
