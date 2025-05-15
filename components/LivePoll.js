import React from 'react';

export default function LivePoll() {
  return (
    <div style={{ padding: 16, backgroundColor: '#f9f9f9', borderRadius: 8, margin: 16 }}>
      <h3>📊 Live Poll: Do you trust AI news summaries?</h3>
      <button style={{ marginRight: 8 }}>👍 Yes</button>
      <button>👎 No</button>
    </div>
  );
}