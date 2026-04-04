import { createIcons, icons } from 'lucide';
import DOMPurify from 'dompurify';
import { LS_API_KEY, LS_GD_KEY } from '../config/constants';

// ─── FOCUS TRAP ──────────────────────────────
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let activeTrapEl: HTMLElement | null = null;
let previousFocus: HTMLElement | null = null;

function onTrapKeydown(e: KeyboardEvent): void {
  if (!activeTrapEl || e.key !== 'Tab') return;
  const focusable = Array.from(activeTrapEl.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null
  );
  if (!focusable.length) { e.preventDefault(); return; }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

function trapFocus(el: HTMLElement): void {
  previousFocus = document.activeElement as HTMLElement | null;
  activeTrapEl = el;
  document.addEventListener('keydown', onTrapKeydown);
  const focusable = el.querySelectorAll<HTMLElement>(FOCUSABLE);
  const first = Array.from(focusable).find((f) => f.offsetParent !== null);
  first?.focus();
}

function releaseFocus(): void {
  document.removeEventListener('keydown', onTrapKeydown);
  activeTrapEl = null;
  previousFocus?.focus();
  previousFocus = null;
}

// ─── TOAST ──────────────────────────────────
export function showToast(
  msg: string,
  type: 'success' | 'error' | 'info' = 'info',
  action?: { label: string; onClick: () => void }
): void {
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
  span.className = 'flex-1';
  span.textContent = DOMPurify.sanitize(msg);
  t.appendChild(icon);
  t.appendChild(span);

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'ml-2 text-xs font-semibold underline hover:no-underline shrink-0';
    btn.textContent = DOMPurify.sanitize(action.label);
    btn.addEventListener('click', () => {
      action.onClick();
      t.remove();
    });
    t.appendChild(btn);
  }

  document.getElementById('toast-area')?.appendChild(t);
  createIcons({ icons });
  setTimeout(() => t.remove(), 3500);
}

// ─── MODALS ──────────────────────────────────
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
  const modal = document.getElementById('modal-apikey');
  modal?.classList.remove('hidden');
  if (modal) trapFocus(modal);
}

export function closeApiKeyModal(): void {
  document.getElementById('modal-apikey')?.classList.add('hidden');
  releaseFocus();
}

export function openGdSetupModal(): void {
  const clientId = localStorage.getItem(LS_GD_KEY) || '';
  const input = document.getElementById('gd-clientid-input') as HTMLInputElement | null;
  const originEl = document.getElementById('current-origin');
  if (input) input.value = clientId;
  if (originEl) originEl.textContent = location.origin;
  const modal = document.getElementById('modal-gd-setup');
  modal?.classList.remove('hidden');
  if (modal) trapFocus(modal);
}

export function closeGdSetupModal(): void {
  document.getElementById('modal-gd-setup')?.classList.add('hidden');
  releaseFocus();
}

export function closeAddModal(): void {
  document.getElementById('modal-add')?.classList.add('hidden');
  releaseFocus();
}

export function openAddModalFocus(): void {
  const modal = document.getElementById('modal-add');
  if (modal) trapFocus(modal);
}

export function closeEditModal(): void {
  document.getElementById('modal-edit')?.classList.add('hidden');
  releaseFocus();
}

export function openEditModalFocus(): void {
  const modal = document.getElementById('modal-edit');
  if (modal) trapFocus(modal);
}
