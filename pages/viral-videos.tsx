import Head from 'next/head';

const mockVideos = [
  { title: 'Street Food Chef Goes Viral', thumb: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800', url: '#' },
  { title: 'Incredible Goal from Midfield', thumb: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800', url: '#' },
  { title: 'Dancer Wins Internet with Moves', thumb: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800', url: '#' },
  { title: 'Adorable Puppy Compilation', thumb: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800', url: '#' }
];

export default function ViralVideosPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Viral Videos - News Pulse</title>
        <meta name="description" content="Trending viral videos curated for you." />
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-6">🎥 Viral Videos</h1>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockVideos.map((v, i) => (
            <a key={i} href={v.url} className="block bg-white dark:bg-gray-800 rounded-2xl border shadow-sm hover:shadow-md transition overflow-hidden">
              <div className="relative">
                <img src={v.thumb} alt={v.title} className="w-full h-48 object-cover" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white text-4xl">▶</div>
              </div>
              <div className="p-4 font-semibold">{v.title}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
