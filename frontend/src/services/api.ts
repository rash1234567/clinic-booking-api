
export interface Slot {
  id: string;
  provider: string;
  start: string;
  end: string;
  available: boolean;
}

export interface Booking {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
}

export interface BookingsResponse {
  bookings: Booking[];
  next_cursor: string | null;
}

const API_URL = '/api';

let apiKey = '';

export function setApiKey(key: string) {
  apiKey = key.trim();
}

export function clearApiKey() {
  apiKey = '';
}

function authHeaders(extra: Record<string, string> = {}) {
  return {
    ...extra,
    'X-API-Key': apiKey,
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data as T;
}

// 1. Get available appointment slots
export async function getSlots(): Promise<Slot[]> {
  const response = await fetch(`${API_URL}/slots`, {
    headers: authHeaders(),
  });

  const data = await handleResponse<{ slots: Slot[] }>(response);
  return data.slots;
}

// 2. Create a booking
export async function createBooking(booking: {
  slot_id: string;
  name: string;
  email: string;
}): Promise<Booking> {
  const response = await fetch(`${API_URL}/bookings`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    }),
    body: JSON.stringify(booking),
  });

  return handleResponse<Booking>(response);
}

// 3. Get a person's bookings
export async function getBookings(
  email: string,
  limit = 10,
  cursor?: string
): Promise<BookingsResponse> {
  const params = new URLSearchParams({
    email: email.trim(),
    limit: String(limit),
  });

  if (cursor) {
    params.set('cursor', cursor);
  }

  const response = await fetch(
    `${API_URL}/bookings?${params.toString()}`,
    { headers: authHeaders() }
  );

  return handleResponse<BookingsResponse>(response);
}

// 4. Get one booking by ID
export async function getBooking(id: string): Promise<Booking> {
  const response = await fetch(
    `${API_URL}/bookings/${encodeURIComponent(id)}`,
    { headers: authHeaders() }
  );

  return handleResponse<Booking>(response);
}

// 5. Cancel a booking
export async function cancelBooking(id: string): Promise<Booking> {
  const response = await fetch(
    `${API_URL}/bookings/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    }
  );

  return handleResponse<Booking>(response);
}

// 6. Reset slots
export async function resetSlots(
  slots: Omit<Slot, 'available'>[]
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/reset`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ slots }),
  });

  return handleResponse<{ message: string }>(response);
}
