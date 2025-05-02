import React from 'react';

interface ErrorDisplayProps {
  error: string | null;
}

export function ErrorDisplay({ error }: ErrorDisplayProps): JSX.Element | null {
  if (!error) {
    return null;
  }

  // TODO: use devops ui styles
  return (
    <div
      style={{
        color: 'red',
        marginBottom: '10px',
        padding: '10px',
        border: '1px solid red',
        borderRadius: '4px',
        backgroundColor: '#ffeeee',
        whiteSpace: 'pre-wrap',
      }}
    >
      <strong>Errors:</strong>
      <br />
      {error}
    </div>
  );
}
