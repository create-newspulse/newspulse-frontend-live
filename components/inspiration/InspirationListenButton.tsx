import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useFeatureFlags } from "../../utils/FeatureFlagProvider";
import { useI18n } from "../../src/i18n/LanguageProvider";

type Props = {
  text: string;
  className?: string;
  style?: React.CSSProperties;
};

function toSpeechLang(lang: "en" | "hi" | "gu"): string {
  if (lang === "hi") return "hi-IN";
  if (lang === "gu") return "gu-IN";
  return "en-IN";
}

export default function InspirationListenButton({ text, className, style }: Props) {
  const { isEnabled } = useFeatureFlags();
  const { lang, t } = useI18n();
  const synthRef = React.useRef<SpeechSynthesis | null>(null);
  const [speaking, setSpeaking] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      try {
        synthRef.current?.cancel();
      } catch {
        // ignore cleanup failures
      }
    };
  }, []);

  React.useEffect(() => {
    try {
      synthRef.current?.cancel();
    } finally {
      setSpeaking(false);
    }
  }, [lang, text]);

  const enabled = isEnabled("voice.enabled", true);
  const cleanedText = text.trim();

  if (!enabled || !cleanedText) return null;

  const toggle = () => {
    if (!synthRef.current) {
      window.alert(t("common.voiceNotSupported"));
      return;
    }

    if (speaking) {
      try {
        synthRef.current.cancel();
      } finally {
        setSpeaking(false);
      }
      return;
    }

    try {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = toSpeechLang(lang);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synthRef.current.speak(utterance);
    } catch {
      setSpeaking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={speaking ? t("inspirationHub.voice.muteTitle") : t("inspirationHub.voice.listenTitle")}
      aria-pressed={speaking}
      className={className || ""}
      style={style}
    >
      <span className="inline-flex items-center gap-2">
        {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {speaking ? t("common.mute") : t("common.listen")}
      </span>
    </button>
  );
}