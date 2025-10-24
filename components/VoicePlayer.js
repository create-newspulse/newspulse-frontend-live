import { useEffect } from 'react';

const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;

const VoicePlayer = ({ text, language, isVoiceEnabled }) => {
  useEffect(() => {
    if (!isVoiceEnabled || !text) return;

    const speakText = async () => {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode:
                language === 'gujarati'
                  ? 'gu-IN'
                  : language === 'hindi'
                  ? 'hi-IN'
                  : 'en-US',
              ssmlGender: 'FEMALE',
            },
            audioConfig: { audioEncoding: 'MP3' },
          }),
        }
      );

      const data = await response.json();
      if (data.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audio.play();
      }
    };

    speakText();
  }, [isVoiceEnabled, text, language]);

  return null;
};

export default VoicePlayer;