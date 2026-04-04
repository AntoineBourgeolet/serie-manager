import { createIcons, icons } from 'lucide';
import DOMPurify from 'dompurify';
import { LS_API_KEY, LS_GD_KEY } from '../config/constants';

export function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const colors = { success: 'bg-green-700', error: 'bg-red-700', info: 'bg-zinc-700' };
  const iconName = type === 'error' ? 'alert-circle' : 'check-circle';
  const t = document.createElement('div');
  t.setAttribute('role', 'alert');
  t.setAttribute('aria-live', 'assertive');
  t.className = `${colors[type]} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2`;
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', iconName);
  icon.className = 'w-4 h-4 shrink-0';
  const span = document.createElement('span');
  span.textContent = DOMPurify.sanitize(msg);
  t.appendChild(icon);
  t.appendChild(span);
  document.getElementById('toast-area')?.appendChild(t);
  createIcons({ icons });
  setTimeout(() => t.remove(), 3500);
}

export function showApiKeyModal(): void {
  const key = localStorage.getItem(LS_API_KEY) || '';
  const input = document.getElementById('apikey-input') as HTMLInputElement | null;
  const errEl = document.getElementById('apikey-error');
  const closeBtn = document.getElementById('apikey-close');
  if (input) input.value = key;
  if (errEl) errEl.classList.add('hidden');
  if (closeBtn) {
    if (key) closeBtn.classList.remove('hidden');
    else closeBtn.classList.add('hidden');
  }
  document.getElementById('modal-apikey')?.classList.remove('hidden');
}

export function closeApiKeyModal(): void {
  document.getElementById('modal-apikey')?.classList.add('hidden');
}

export function openGdSetupModal(): void {
  const clientId = localStorage.getItem(LS_GD_KEY) || '';
  const input = document.getElementById('gd-clientid-input') as HTMLInputElement | null;
  const originEl = document.getElementById('current-origin');
  if (input) input.value = clientId;
  if (originEl) originEl.textContent = location.origin;
  document.getElementById('modal-gd-setup')?.classList.remove('hidden');
}

export function closeGdSetupModal(): void {
  document.getElementById('modal-gd-setup')?.classList.add('hidden');
}

export function closeAddModal(): void {
  document.getElementById('modal-add')?.classList.add('hidden');
}

export function closeEditModal(): void {
  document.getElementById('modal-edit')?.classList.add('hidden');
}
