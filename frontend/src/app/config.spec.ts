import { apiBaseUrl } from './config';

describe('apiBaseUrl', () => {
  it('uses backend-node on port 8000 for a dev server on localhost (ng serve, a preview, the dev compose)', () => {
    expect(apiBaseUrl('localhost', '4200')).toBe('http://localhost:8000');
    expect(apiBaseUrl('127.0.0.1', '8080')).toBe('http://localhost:8000');
  });

  it('uses the same origin when localhost is served on a standard port (the docker stack behind Caddy)', () => {
    expect(apiBaseUrl('localhost', '')).toBe('');
    expect(apiBaseUrl('127.0.0.1', '')).toBe('');
  });

  it('uses the same origin on a real domain, whatever the port', () => {
    expect(apiBaseUrl('hanoicenturyvista.com', '')).toBe('');
    expect(apiBaseUrl('example.com', '4200')).toBe('');
  });
});
