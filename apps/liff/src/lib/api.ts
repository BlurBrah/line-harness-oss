import { getIdToken, getLiffId } from './liff-auth.js';

const BASE = import.meta.env.VITE_API_BASE ?? '';

export interface MenuItem {
  id: string;
  name: string;
  category_label: string | null;
  description: string | null;
  duration_minutes: number;
  buffer_after_minutes: number;
  base_price: number;
  sort_order: number;
}

export interface StaffItem {
  id: string;
  display_name: string;
  role: string | null;
  profile_image_url: string | null;
  bio: string | null;
  is_designation_optional: number;
  price: number;
  duration_minutes: number;
}

export interface AvailabilityResponse {
  by_staff: Array<{
    staff_id: string;
    display_name: string;
    slots: Array<{ date: string; start: string; end: string }>;
  }>;
}

export interface BookingHistoryItem {
  id: string;
  starts_at: string;
  status: string;
  customer_note?: string | null;
  menu_name: string;
  staff_name: string;
  profile_image_url: string | null;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${getIdToken()}`, ...extra };
}

async function get<T>(path: string): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  url.searchParams.set('liffId', getLiffId());
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  url.searchParams.set('liffId', getLiffId());
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', ...headers }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }
    const err = new Error(`API ${res.status}`) as Error & { status: number; body: unknown };
    err.status = res.status;
    err.body = parsed ?? text;
    throw err;
  }
  return res.json();
}

// ============================================================
// Event booking types
// ============================================================

export interface EventDetail {
  id: string;
  name: string;
  venue_name: string | null;
  venue_url: string | null;
  image_url: string | null;
  description: string | null;
  description_centered: number;
  max_bookings_per_friend: number | null;
  requires_approval: number;
  cancel_deadline_hours_before: number | null;
}

export interface EventSlot {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  is_active: number;
  active_count: number;
  remaining: number | null;
}

export interface EventBookingMine {
  id: string;
  event_id: string;
  status: string;
  customer_note: string | null;
  event_name: string;
  event_image_url: string | null;
  venue_name: string | null;
  venue_url: string | null;
  cancel_deadline_hours_before: number | null;
  slot_starts_at: string;
  slot_ends_at: string;
}

const isPreview = new URLSearchParams(window.location.search).get('mode') === 'preview';

const mockMenus: MenuItem[] = [
  { id: '1', name: '初回ダイエット診断カウンセリング', category_label: 'おすすめ', description: '体質・生活習慣を分析し、あなた専用のダイエットプランをご提案', duration_minutes: 60, buffer_after_minutes: 0, base_price: 0, sort_order: 1 },
  { id: '2', name: '初回体験コース', category_label: 'おすすめ', description: 'カウンセリング＋施術のフルコース体験', duration_minutes: 90, buffer_after_minutes: 0, base_price: 21980, sort_order: 2 },
  { id: '3', name: 'オンラインカウンセリング', category_label: 'オンライン', description: 'ご自宅からビデオ通話でカウンセリング', duration_minutes: 30, buffer_after_minutes: 0, base_price: 0, sort_order: 3 },
];

const mockStaff: StaffItem[] = [
  { id: '1', display_name: '新田 友里', role: 'ダイエットカウンセラー', profile_image_url: 'https://www.lislim.jp/wp-content/uploads/IMG_8974-scaled.jpg', bio: 'エステティシャン歴18年', is_designation_optional: 0, price: 0, duration_minutes: 60 },
];

function mockSlots() {
  const slots: Array<{ date: string; start: string; end: string }> = [];
  const now = new Date();
  for (let d = 1; d <= 7; d++) {
    const date = new Date(now.getTime() + d * 86400000);
    if (date.getDay() === 0) continue;
    const ds = date.toISOString().slice(0, 10);
    for (const h of ['10:00', '11:00', '13:00', '14:00', '15:00']) {
      slots.push({ date: ds, start: h, end: h.replace(/^\d+/, (m) => String(Number(m) + 1)) });
    }
  }
  return slots;
}

const mockApi = {
  menus: () => Promise.resolve({ menus: mockMenus }),
  staffOf: (_menuId: string) => Promise.resolve({ staff: mockStaff }),
  availability: (_menuId: string, _staffId: string | undefined, _from: string, _to: string) =>
    Promise.resolve({ by_staff: [{ staff_id: '1', display_name: '新田 友里', slots: mockSlots() }] }),
  createRequest: (_body: unknown, _idemKey: string) => Promise.resolve({ booking_id: 'preview', status: 'requested' }),
  me: () => Promise.resolve({ upcoming: [], past: [] }),
  getEvent: (_id: string) => Promise.reject(new Error('preview')),
  getEventSlots: (_id: string) => Promise.reject(new Error('preview')),
  createEventBooking: (_eid: string, _body: unknown, _key: string) => Promise.reject(new Error('preview')),
  myEventBookings: (_tab: 'upcoming' | 'past') => Promise.resolve({ items: [] }),
  cancelMyEventBooking: (_id: string) => Promise.reject(new Error('preview')),
};

export const api = isPreview ? mockApi : {
  menus: () => get<{ menus: MenuItem[] }>('/api/liff/booking/menus'),
  staffOf: (menuId: string) =>
    get<{ staff: StaffItem[] }>(`/api/liff/booking/menus/${menuId}/staff`),
  availability: (menuId: string, staffId: string | undefined, from: string, to: string) => {
    const qs = new URLSearchParams({ menu_id: menuId, from, to });
    if (staffId) qs.set('staff_id', staffId);
    return get<AvailabilityResponse>(`/api/liff/booking/availability?${qs}`);
  },
  // Worker 側で id_token を verify するので lineUserId は body に入れない。
  createRequest: (
    body: { menu_id: string; staff_id: string; starts_at: string; customer_note?: string },
    idempotencyKey: string,
  ) =>
    post<{ booking_id: string; status: string }>(
      '/api/liff/booking/requests',
      body,
      { 'Idempotency-Key': idempotencyKey },
    ),
  me: () => get<{ upcoming: BookingHistoryItem[]; past: BookingHistoryItem[] }>('/api/liff/booking/me'),

  // ===== Event booking =====
  getEvent: (id: string) => get<EventDetail>(`/api/liff/events/${id}`),
  getEventSlots: (id: string) => get<{ items: EventSlot[] }>(`/api/liff/events/${id}/slots`),
  createEventBooking: (
    eventId: string,
    body: { slot_id: string; customer_note?: string | null },
    idempotencyKey: string,
  ) =>
    post<{ id: string; status: string }>(
      `/api/liff/events/${eventId}/bookings`,
      body,
      { 'Idempotency-Key': idempotencyKey },
    ),
  myEventBookings: (tab: 'upcoming' | 'past') =>
    get<{ items: EventBookingMine[] }>(`/api/liff/events/me?tab=${tab}`),
  cancelMyEventBooking: (bookingId: string) =>
    post<{ ok: true }>(`/api/liff/events/me/${bookingId}/cancel`, {}),
};
