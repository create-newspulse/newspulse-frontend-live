import React from 'react';

export default function BottomNavigation() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-around',
      backgroundColor: '#E63946',
      color: 'white',
      padding: '12px 0'
    }}>
      <div>🏠 Home</div>
      <div>🎧 Audio</div>
      <div>🔍 Search</div>
      <div>🔖 Saved</div>
    </div>
  );
}