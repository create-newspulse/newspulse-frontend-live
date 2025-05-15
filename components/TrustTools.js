// components/TrustTools.js
import {
  getTrustLevelBadge,
  getQuickSummary,
  generateSmartResponse
} from './TrustTools';

export function getTrustLevelBadge(score) {
  if (score >= 80) return "🟢 Verified";
  if (score >= 50) return "🟠 Mixed";
  return "🔴 Caution";
}

export function getQuickSummary(content) {
  const summary = content.split('.').slice(0, 2).join('. ') + '.';
  return summary;
}

export function generateSmartResponse(articleText, question) {
  if (question.includes("summary")) return getQuickSummary(articleText);
  if (question.includes("who") || question.includes("when"))
    return "It was reported by trusted sources recently.";
  return "This story covers an important update for readers.";
}