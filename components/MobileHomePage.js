import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import BreakingTicker from './BreakingTicker';
import TopNews from './TopNews';
import VoicePlayer from './VoicePlayer';
import WebStories from './WebStories';
import LivePoll from './LivePoll';
import YouthPulse from './YouthPulse';
import BottomNavigation from './BottomNavigation';

export default function MobileHomePage() {
  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ padding: 16, backgroundColor: '#E63946' }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: 'white' }}>📰 News Pulse</Text>
        <Text style={{ fontSize: 14, color: '#ffe' }}>Smart News. Real Voice.</Text>
      </View>

      <ScrollView>
        <BreakingTicker />
        <TopNews />
        <VoicePlayer />
        <WebStories />
        <LivePoll />
        <YouthPulse />
      </ScrollView>

      <BottomNavigation />
    </View>
  );
}
