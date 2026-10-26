async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

export function getHealth() {
  return request("/api/health");
}

export function getBootstrap(userId) {
  return request(`/api/bootstrap?user_id=${encodeURIComponent(userId)}`);
}

export function registerKeys(payload) {
  return request("/api/users/keys", { method: "POST", body: JSON.stringify(payload) });
}

export function createFile(payload) {
  return request("/api/files", { method: "POST", body: JSON.stringify(payload) });
}

export function createShare(payload) {
  return request("/api/shares", { method: "POST", body: JSON.stringify(payload) });
}

export function addActivity(payload) {
  return request("/api/activity", { method: "POST", body: JSON.stringify(payload) });
}

export function sendLiveOffer(payload) {
  return request("/api/live/offer", { method: "POST", body: JSON.stringify(payload) });
}

export function sendLiveAccept(payload) {
  return request("/api/live/accept", { method: "POST", body: JSON.stringify(payload) });
}

export function sendLiveData(payload) {
  return request("/api/live/data", { method: "POST", body: JSON.stringify(payload) });
}

export function sendLiveComplete(payload) {
  return request("/api/live/complete", { method: "POST", body: JSON.stringify(payload) });
}

export function pollLive(userId, cursor) {
  return request(`/api/live/poll?user_id=${encodeURIComponent(userId)}&cursor=${cursor}`);
}
