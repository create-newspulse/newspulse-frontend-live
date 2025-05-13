type NewsItem = {
  id: string;
  title: string;
  content: string;
};

type NewsReaderProps = {
  newsItems: NewsItem[];
  playVoice: (text: string) => void;
  language: string;
};

export default function NewsReader({ newsItems, playVoice, language }: NewsReaderProps) {
}
