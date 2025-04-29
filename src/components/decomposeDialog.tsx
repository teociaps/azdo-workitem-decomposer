import * as React from 'react';

export const DialogComponent: React.FC = () => {
  return (
    <div style={{ padding: 20 }}>
      <h2>Hello from custom dialog!</h2>
      <p>You can place any React content here.</p>
      <button onClick={() => alert('You clicked inside the dialog!')}>Click Me</button>
    </div>
  );
};
