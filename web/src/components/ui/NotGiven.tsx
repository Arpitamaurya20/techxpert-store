import React from 'react';

/** Muted placeholder for missing data, so a blank is never mistaken for a real value. */
export const NotGiven: React.FC<{ label?: string }> = ({ label = 'Not given' }) => (
  <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontWeight: 400 }}>{label}</span>
);
