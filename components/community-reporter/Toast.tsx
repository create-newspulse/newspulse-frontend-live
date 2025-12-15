import React from 'react';

type Props = {
  message: string | null;
};

const Toast: React.FC<Props> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
      {message}
    </div>
  );
};

export default Toast;
