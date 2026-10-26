let token = sessionStorage.getItem("sv2-session") || "";

export function setToken(value) {
  token = value || "";
  if (token) {
    sessionStorage.setItem("sv2-session", token);
  } else {
    sessionStorage.removeItem("sv2-session");
  }
}

export async function request(path, options = {}) {
  const binary = options.body instanceof Uint8Array;
  const headers = { ...options.headers };
  if (token) {
    headers.Authorization = "Bearer " + token;
  }
  let body = options.body;
  if (body !== undefined && !binary) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  if (binary) {
    headers["Content-Type"] = "application/octet-stream";
  }
  let response;
  try {
    response = await fetch(path, { ...options, headers, body, cache: "no-store" });
  } catch {
    throw new Error("Không kết nối được máy chủ. Mở SecretVault trên PC hoặc kiểm tra địa chỉ host.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const exception = new Error(error.error || "Yêu cầu thất bại (" + response.status + ")");
    exception.status = response.status;
    throw exception;
  }
  if (options.binary) {
    return new Uint8Array(await response.arrayBuffer());
  }
  return response.json();
}

export const get = (path) => request(path);
export const post = (path, body) => request(path, { method: "POST", body });
export const remove = (path) => request(path, { method: "DELETE" });
