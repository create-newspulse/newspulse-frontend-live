import { useState, useEffect, useRef } from 'react';
import VoiceButton from './VoiceButton';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

export default function VoiceCarousel({ headlines, language }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const swiperRef = useRef(null);

  useEffect(() => {
    // Reset index when headlines change
    setCurrentIndex(0);
    if (swiperRef.current) {
      swiperRef.current.swiper.slideTo(0);
    }
  }, [headlines]);

  const fontClass = language === 'hindi' ? 'font-hindi' : language === 'gujarati' ? 'font-gujarati' : 'font-english';

  const categoryIcons = {
    general: '🌐',
    technology: '💻',
    sports: '⚽',
    business: '💼',
    entertainment: '🎬',
    health: '🩺',
    science: '🔬',
  };

  return (
    <div className={`bg-newsPulse-white rounded-lg shadow-md p-4 ${fontClass}`}>
      <h2 className="text-xl font-semibold text-newsPulse-navy mb-4">
        {language === 'hindi' ? 'सुनने के लिए स्वाइप करें' : language === 'gujarati' ? 'સાંભળવા માટે સ્વાઇપ કરો' : 'Swipe to Listen'}
      </h2>
      {headlines.length === 0 ? (
        <p className="text-center text-newsPulse-slate">
          {language === 'hindi' ? 'कोई समाचार उपलब्ध नहीं।' : language === 'gujarati' ? 'કોઈ સમાચાર ઉપલબ્ધ નથી.' : 'No headlines available.'}
        </p>
      ) : (
        <Swiper
          ref={swiperRef}
          direction="vertical"
          modules={[Navigation, Pagination]}
          spaceBetween={20}
          slidesPerView={1}
          pagination={{ clickable: true }}
          onSlideChange={(swiper) => setCurrentIndex(swiper.activeIndex)}
          className="h-64"
        >
          {headlines.map((headline, index) => (
            <SwiperSlide key={headline.id || index}>
              <div className="flex flex-col items-center justify-center h-full bg-newsPulse-slate/10 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs text-newsPulse-blue">
                    {categoryIcons[headline.category] || '📰'} {headline.category.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-lg font-medium text-newsPulse-navy text-center">{headline.text || 'No title'}</h3>
                <p className="text-sm text-newsPulse-slate mt-1">{headline.source || 'Unknown'}</p>
                <p className="text-xs text-newsPulse-slate/80 mt-1">
                  {headline.publishedAt
                    ? new Date(headline.publishedAt).toLocaleDateString(
                        language === 'hindi' ? 'hi-IN' : language === 'gujarati' ? 'gu-IN' : 'en-US'
                      )
                    : 'No date'}
                </p>
                <div className="mt-4">
                  <VoiceButton language={language} headline={headline} />
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
}
