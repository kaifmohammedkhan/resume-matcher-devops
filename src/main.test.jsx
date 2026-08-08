import { render } from '@testing-library/react';
import App from './App';

test('renders App inside StrictMode', () => {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);

  render(<App />, { container: root });
  expect(root).toBeTruthy();
});
