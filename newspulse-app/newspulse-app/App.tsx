import React, { useEffect } from 'react';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// 👉 Define Colors
const Colors = {
  primary: '#007AFF',
  background: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
};

// 📌 Prevent splash from auto-hiding
SplashScreen.preventAutoHideAsync();

// 🔁 Create Stack Navigator
const Stack = createNativeStackNavigator();

// ✅ Home Screen
function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to News Pulse</Text>
        <Text style={styles.subtitle}>Your personalized news feed</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
        <Text style={styles.placeholder}>Loading latest news...</Text>
      </View>
    </SafeAreaView>
  );
}

// ✅ Main App Function
export default function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('./assets/fonts/Inter-Regular.ttf'),
    'Inter-Bold': require('./assets/fonts/Inter-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.text,
            headerTitleStyle: { fontFamily: 'Inter-Bold' },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// 🎨 Styles
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
  },
  placeholder: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
