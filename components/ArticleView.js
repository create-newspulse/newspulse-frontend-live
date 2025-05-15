// components/ArticleView.js

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ArticleTools } from './ArticleTools';

export default function ArticleView({ article }) {
  // Sample article content (replace this with real CMS/API data)
  const sampleArticle = {
    title: "ISRO Launches New Satellite 🚀",
    body: "India's ISRO launched a new weather satellite from Sriharikota. The mission aims to improve cyclone prediction. It was a successful launch witnessed by many top scientists.",
    trustScore: 85, // Or dynamically set based on data
  };

  return (
    <ScrollView style={styles.container}>
      {/* Article Title */}
      <Text style={styles.title}>{article?.title || sampleArticle.title}</Text>

      {/* Article Content */}
      <Text style={styles.body}>{article?.body || sampleArticle.body}</Text>

      {/* 🧠 Trust Tools Section */}
      <ArticleTools article={article || sampleArticle} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
});
