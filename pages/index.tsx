"use client";

import Head from 'next/head';
import Script from 'next/script';
import React, { useState, useEffect } from 'react';
import VoiceButton from '../components/VoiceButton';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../utils/LanguageContext';
import { motion } from 'framer-motion';
import AppDownloadSection from '../components/AppDownloadSection';
import { fetchRssNews } from '../lib/fetchRssNews';

// ✅ Define RSS item type
type RssItem = {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
};

export default function HomePage() {
  const { language } = useLanguage();
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [rssNews, setRssNews] = useState<RssItem[]>([]); // ✅ Type added

  const toggleVoice = () => setIsVoiceEnabled(prev => !prev);

  useEffect(() => {
    fetchRssNews("World News").then(setRssNews);
  }, []);

  return (
    <div className={`min-h-screen bg-white text-black font-${language} overflow-x-hidden`}>
      <Head>
        <title>News Pulse</title>
        <meta name="description" content="Top headlines & live breaking news from around the world – curated by News Pulse." />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet" />
      </Head>

      {/* ✅ Google Analytics */}
      {process.env.NEXT_PUBLIC_GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `,
            }}
          />
        </>
      )}

      {/* 🔴 Breaking News */}
      <div className="bg-black overflow-hidden whitespace-nowrap py-2">
        <motion.div
          className="text-white font-bold text-base inline-block"
          initial={{ x: '100%' }}
          animate={{ x: '-100%' }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        >
          🔴 Live | 🗞️ Breaking: Market surges after Fed decision 🔸 India to host G20 AI Summit 🔸 Global protests rise over climate delay...
        </motion.div>
      </div>

      {/* 🔵 Hero Section */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-center py-16 px-4">
        <h1 className="text-5xl sm:text-7xl font-extrabold text-white">News Pulse</h1>
        <p className="text-white text-lg mt-4 tracking-wide">Your pulse on what matters most.</p>
        <div className="mt-8 flex justify-center gap-4">
          <LanguageToggle />
          <VoiceButton language={language} isVoiceEnabled={isVoiceEnabled} toggleVoice={toggleVoice} />
        </div>
      </div>

      {/* 📰 RSS Feed */}
      <section className="px-4 py-12 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">📰 Latest RSS Feed News</h2>
        <ul className="space-y-6">
          {rssNews.map((item: RssItem, i) => (
            <li key={i} className="p-5 border rounded-lg shadow hover:shadow-md transition">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xl font-semibold text-blue-700 hover:underline"
              >
                {item.title}
              </a>
              <p className="text-sm text-gray-500 mt-2">{item.pubDate}</p>
              <p className="text-gray-700 mt-2">{item.description?.slice(0, 150)}...</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 📲 App Download */}
      <AppDownloadSection />

      {/* 💰 Monetization */}
      <section className="bg-gray-50 border-t py-6 px-4 text-center text-sm text-gray-600">
        <div className="flex flex-wrap justify-center gap-6 items-center font-medium text-gray-800">
          <span>💼 <a href="#" className="hover:underline">Advertise With Us</a></span>
          <span>📢 <a href="#" className="hover:underline">Promotions</a></span>
          <span>📈 <a href="#" className="hover:underline">Media Kit (Coming Soon)</a></span>
        </div>
      </section>

      {/* 🛍 App Store Badges */}
      <section className="py-12 px-4 text-center bg-white">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">📲 News Pulse in your hand</h3>
        <p className="text-gray-600 mb-6">Download our app and stay informed wherever you go.</p>
        <div className="flex justify-center items-center gap-6 flex-wrap">
          <a href="#" target="_blank" rel="noopener noreferrer">
            <img src="/google-play-badge.png" alt="Get it on Google Play" className="h-14 hover:scale-105 transition-transform" />
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer">
            <img src="/app-store-badge.png" alt="Download on the App Store" className="h-14 hover:scale-105 transition-transform" />
          </a>
        </div>
      </section>

      {/* 🔗 Footer */}
      <footer className="bg-gray-100 border-t border-gray-300 py-10 text-center">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Connect with Us</h3>
        <div className="flex justify-center flex-wrap gap-6 font-medium text-blue-700">
          {['Facebook', 'X page', 'YouTube', 'LinkedIn', 'Pinterest', 'Instagram'].map((platform, i) => (
            <a key={i} href="#" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-indigo-500">
              {platform}
            </a>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-6">© {new Date().getFullYear()} News Pulse. All rights reserved.</p>
      </footer>
    </div>
  );
}
