// components/ArticleTools.js

import React, { useState } from 'react';
import { Text, TouchableOpacity, TextInput, Button, View } from 'react-native';

// 🟢 Trust Badge
export function getTrustLevelBadge(score) {
  if (score >= 80) return "🟢 Verified";
  if (score >= 50) return "🟠 Mixed";
  return "🔴 Caution";
}

// 📘 Quick Summary
export function getQuickSummary(content) {
  const summary = content.split('.').slice(0, 2).join('. ') + '.';
  return summary;
}

// 💬 Instant Response
export function generateSmartResponse(articleText, question) {
  if (question.includes("summary")) return getQuickSummary(articleText);
  if (question.includes("who") || question.includes("when"))
    return "It was reported by trusted sources recently.";
  return "This story covers an important update for readers.";
}

// 📦 Combined UI Block
export function ArticleTools({ article }) {
  const [showSummary, setShowSummary] = useState(false);
  const [showAsk, setShowAsk] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  return (
    <View style={{ marginTop: 20 }}>
      {/* Trust Badge */}
      <Text style={{ fontSize: 14, color: 'gray' }}>
        Trust: {getTrustLevelBadge(article.trustScore || 70)}
      </Text>

      {/* Quick Summary */}
      <TouchableOpacity onPress={() => setShowSummary(!showSummary)}>
        <Text style={{ color: '#007aff', marginTop: 8 }}>📘 Quick Summary</Text>
      </TouchableOpacity>
      {showSummary && (
        <Text style={{ marginTop: 10 }}>{getQuickSummary(article.body)}</Text>
      )}

      {/* Ask a Question */}
      <TouchableOpacity onPress={() => setShowAsk(true)}>
        <Text style={{ color: '#007aff', marginTop: 20 }}>💬 Ask About This</Text>
      </TouchableOpacity>
      {showAsk && (
        <>
          <TextInput
            placeholder="Type your question"
            value={userQuestion}
            onChangeText={setUserQuestion}
            style={{ borderWidth: 1, padding: 8, marginVertical: 10 }}
          />
          <Button
            title="Get Answer"
            onPress={() =>
              setAnswer(generateSmartResponse(article.body, userQuestion))
            }
          />
          <Text style={{ marginTop: 10 }}>{answer}</Text>
        </>
      )}
    </View>
  );
}
