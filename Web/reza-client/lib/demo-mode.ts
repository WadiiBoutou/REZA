const DEMO_SESSION_KEY = 'reza-client-demo-mode';

export const DEMO_CLIENT = {
  email: 'demo.client@reza.ma',
  password: 'demo1234',
};

export function enableDemoMode() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DEMO_SESSION_KEY, 'true');
  window.dispatchEvent(new Event('reza-demo-mode-change'));
}

export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true;
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('demo') === 'true') {
    sessionStorage.setItem(DEMO_SESSION_KEY, 'true');
  }
  return sessionStorage.getItem(DEMO_SESSION_KEY) === 'true';
}