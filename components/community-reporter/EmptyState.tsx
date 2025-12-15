import React from 'react';

const EmptyState: React.FC<{ text?: string }> = ({ text = 'No items found.' }) => {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
      {text}
    </div>
  );
};

export default EmptyState;
