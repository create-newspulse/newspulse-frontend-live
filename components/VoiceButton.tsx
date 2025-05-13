import { useState } from 'react';

type VoiceButtonProps = {
  language: string;
  isVoiceEnabled: boolean;
  toggleVoice: () => void;
};

export default function VoiceButton({ language, isVoiceEnabled, toggleVoice }: VoiceButtonProps) {
  const [isListening, setIsListening] = useState(false);

  const handleVoiceCommand = () => {
    setIsListening(!isListening);
    toggleVoice();

    const message = isListening
      ? language === 'hindi'
        ? 'सुनना बंद...'
        : language === 'gujarati'
        ? 'સાંભળવું બંધ...'
        : 'Stopped listening.'
      : language === 'hindi'
      ? 'सुनना शुरू...'
      : language === 'gujarati'
      ? 'સાંભળવું શરૂ...'
      : 'Started listening.';

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(message);
      utter.lang = language === 'hindi' ? 'hi-IN' : language === 'gujarati' ? 'gu-IN' : 'en-IN';
      utter.rate = 1.1;
      utter.pitch = 1.0;
      utter.volume = 1.0;
      window.speechSynthesis.speak(utter);
    }
  };

  return (
    <button
      onClick={handleVoiceCommand}
      className={`px-5 py-2 rounded-full text-white transition duration-200 flex items-center space-x-2 ${
        isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
      }`}
    >
      <span className="material-icons">🎙️</span>
      <span>{isListening ? 'Listening...' : 'Start Voice'}</span>
    </button>
  );
}
