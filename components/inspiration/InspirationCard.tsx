import React from 'react';
import { motion } from 'framer-motion';

export type InspirationItem = {
  id: string;
  title: string;
  emoji: string;
  videoUrl: string;
  note?: string;
};

type Props = {
  item: InspirationItem;
};

export default function InspirationCard({ item }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm"
    >
      <div className="p-5 flex items-center gap-3">
        <div className="text-2xl" aria-hidden>
          {item.emoji}
        </div>
        <h3 className="text-xl font-bold">{item.title}</h3>
      </div>
      <div
        className={
          `relative w-full aspect-video ` +
          (
            item.id === 'daily-wonders'
              ? 'rounded overflow-hidden border-2 border-yellow-400 shadow-lg bg-yellow-50 dark:bg-yellow-900/30 flex flex-col items-center justify-center'
              : item.id === 'drone-tv'
              ? 'rounded overflow-hidden border border-gray-300 shadow bg-black'
              : 'bg-black'
          )
        }
        style={item.id === 'daily-wonders' ? ({ minHeight: 240 } as React.CSSProperties) : undefined}
      >
        {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
        <iframe
          src={item.videoUrl}
          className="absolute inset-0 h-full w-full"
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      {item.note && (
        <div className="p-4 text-sm text-gray-600 dark:text-gray-300">✅ {item.note}</div>
      )}
    </motion.section>
  );
}
