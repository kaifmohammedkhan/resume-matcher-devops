import { render } from '@testing-library/react';
import App from '../App.jsx';

test('renders App into root', () => {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  render(<App />, { container: root });
  expect(root).toBeTruthy();
});
