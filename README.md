# 📰 News Pulse - Advanced News Platform

> **A world-class, modern news platform built with Next.js, featuring real-time updates, dark mode, PWA capabilities, and advanced analytics.**

![News Pulse Preview](https://via.placeholder.com/1200x600/1f2937/ffffff?text=News+Pulse+Platform)

## ✨ Features

### 🎨 **Modern Design**
- **Premium UI/UX** with professional animations
- **Dark/Light Theme** with system preference detection
- **Glass-morphism effects** and backdrop blur
- **Responsive design** for all devices
- **Advanced typography** with optimized fonts

### 📱 **PWA (disabled by default)**
- PWA features (install/offline/service worker) are disabled by default for a simpler setup.
- No service worker or web app manifest is shipped in production.
- You can re-enable later by adding a manifest and a SW, and wiring them in `_document.tsx` and `_app.tsx`.

### 🔍 **Advanced Search**
- **Real-time suggestions** with autocomplete
- **Category filtering** and advanced queries
- **Search analytics** and insights
- **Mobile-optimized** search experience

### 📊 **Analytics & Performance**
- **Core Web Vitals** monitoring
- **User engagement** tracking
- **Performance budgets** and optimization
- **Real-time analytics** dashboard

### 📰 **Live News Integration**
- **Real-time updates** every 5 minutes
- **Multi-source** news aggregation
- **Category-based** filtering
- **Breaking news** alerts

### 🔖 **User Features**
- **Article bookmarking** with persistent storage
- **Reading preferences** and customization
- **Mobile navigation** with gestures
- **Voice search** capabilities

## 🚀 Quick Start

For current project conventions and safety checks, read [rules.md](./rules.md).
For application structure, data flows, and integration boundaries, read [architecture.md](./architecture.md).
Use [package.json](./package.json) for current runtime and dependency requirements.

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/newspulse-frontend.git

# Navigate to project directory
cd newspulse-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the application.

### Backend API base (required)

Create `.env.local` with:

```dotenv
NEXT_PUBLIC_API_BASE_DEV=http://localhost:3010
```

On Vercel (production deployment), set:

```dotenv
NEXT_PUBLIC_API_BASE_PROD=https://PROD_BACKEND_DOMAIN
```

You can still use the legacy single var `NEXT_PUBLIC_API_BASE`, but the split vars are recommended.

### Admin + Public environment separation

This frontend assumes **environment separation happens at the backend**:

- Local Admin + Local Public → point to the **dev backend**, which must use the **dev DB**
- Production Admin + Production Public → point to the **prod backend**, which must use the **prod DB**

In practice:

- DEV backend DB: `newspulse_dev`
- PROD backend DB: `newspulse_prod`

Frontend env:

- Local: set `NEXT_PUBLIC_API_BASE_DEV=http://localhost:3010`
- Vercel: set `NEXT_PUBLIC_API_BASE_PROD=https://YOUR_PROD_BACKEND_DOMAIN`

Safety: in dev, the server will refuse a `newspulse.co.in` backend unless you explicitly set `NEXT_PUBLIC_ALLOW_PROD_BACKEND_IN_DEV=true`.

For the backend/DB contract (DEV=`newspulse_dev`, PROD=`newspulse_prod`), see [BACKEND_ENV_SEPARATION.md](BACKEND_ENV_SEPARATION.md).

## 🛠️ Tech Stack

### **Frontend**
- **Next.js 15.3.2** - React framework with SSR/SSG
- **React 19.1.0** - UI library with latest features
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Advanced animations and interactions

### **Performance & PWA**
- **Service Workers** - Offline functionality and caching
- **Intersection Observer** - Lazy loading and performance
- **Web Vitals** - Performance monitoring
- **Image Optimization** - Next.js optimized images

### **Analytics & Tracking**
- **Google Analytics 4** - User behavior tracking
- **Custom Analytics** - Performance and engagement metrics
- **Error Tracking** - Comprehensive error monitoring

## 📁 Project Structure

```
newspulse-frontend/
├── components/           # Reusable UI components
│   ├── BookmarkButton.tsx
│   ├── MobileNavigation.tsx
│   └── OptimizedComponents.tsx
├── hooks/               # Custom React hooks
│   ├── useAnalytics.ts
│   ├── useBookmarks.ts
│   ├── useLiveNews.ts
│   └── usePerformance.ts
├── lib/                 # Utility functions
│   ├── analytics.js
│   ├── fetchHeadlines.js
│   └── gtag.js
├── pages/               # Next.js pages
│   ├── api/            # API routes
│   ├── _app.tsx        # App wrapper
│   ├── _document.tsx   # Document structure
│   └── index.tsx       # Homepage
├── public/              # Static assets
│   ├── icons/          # Favicons / app icons
│   └── favicon.ico     # Site favicon
├── styles/              # Global styles
├── utils/               # Context providers
│   ├── LanguageContext.tsx
│   └── ThemeContext.tsx
└── README.md
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file:

```env
# Analytics
NEXT_PUBLIC_GA_ID=your_google_analytics_id

# News API (optional)
NEWS_API_KEY=your_news_api_key

# Site URL
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### PWA Configuration

PWA is currently disabled. To enable PWA:
1) Create `public/manifest.json` and reference it from `pages/_document.tsx`.
2) Add a `public/sw.js` and register it from `pages/_app.tsx` (production only).
3) Provide a full set of icons under `public/icons/` and update the manifest.

## 📊 Performance

### **Core Web Vitals Scores**
- **LCP (Largest Contentful Paint)**: < 2.5s ✅
- **FID (First Input Delay)**: < 100ms ✅  
- **CLS (Cumulative Layout Shift)**: < 0.1 ✅

### **Lighthouse Scores**
- **Performance**: 95+ ⚡
- **Accessibility**: 95+ ♿
- **Best Practices**: 95+ 🏆
- **SEO**: 95+ 🔍

## 🚀 Deployment

### **Vercel (Recommended)**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/newspulse-frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### **Manual Deployment**

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📱 PWA Installation

### **Desktop**
1. Visit the website in Chrome/Edge
2. Click the install icon in the address bar
3. Follow the installation prompts

### **Mobile**
1. Visit the website in mobile browser
2. Tap "Add to Home Screen"
3. Enjoy the native app experience

## 🔍 SEO Features

- **Meta tags** optimization
- **Open Graph** tags for social sharing
- **Structured data** markup
- **Sitemap** generation
- **Robots.txt** configuration

## 📈 Analytics Dashboard

Track key metrics:
- **User engagement** and session duration
- **Popular articles** and categories
- **Search queries** and trends
- **Performance metrics** and Core Web Vitals
- **Mobile vs desktop** usage

## 🛡️ Security

- **Content Security Policy** implemented
- **HTTPS** enforced
- **Input sanitization** for user data
- **Rate limiting** on API endpoints
- **Privacy-focused** analytics

## 🌐 Multi-language Support

- **English**, **Hindi**, **Gujarati** supported
- **RTL support** ready
- **Dynamic language** switching
- **Localized content** and dates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js team** for the amazing framework
- **Vercel** for seamless deployment
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for smooth animations
- **News API** providers for data sources

## 📞 Support

- **Documentation**: [Wiki](https://github.com/yourusername/newspulse-frontend/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/newspulse-frontend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/newspulse-frontend/discussions)

---

**Built with ❤️ by the News Pulse Team**

**⭐ Star this repository if you found it helpful!**

## 🧪 Development tips: Service Worker and Fast Refresh

During local development, a stale service worker can interfere with Next.js Fast Refresh and HMR.

- The app only registers the service worker in production.
- The service worker itself has a localhost guard and will unregister on activate if it ever runs locally.

If you still see repeated “Fast Refresh had to perform a full reload” messages:

1. Open DevTools → Application → Service Workers → click Unregister.
2. In Application → Storage, click “Clear site data”.
3. Close all tabs for the app and open a fresh private window.
4. Restart the dev server: `npm run dev`.

This ensures no cached app shell or SW is fighting with Next’s dev server.