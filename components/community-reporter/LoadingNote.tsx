import React from 'react';

const LoadingNote: React.FC<{ text?: string }> = ({ text = 'Loading…' }) => {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
      {text}
    </div>
  );
};

export default LoadingNote;
