import React from 'react';
import { SafeAreaView } from 'react-native';
import ArticleView from './components/ArticleView';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ArticleView />
    </SafeAreaView>
  );
}