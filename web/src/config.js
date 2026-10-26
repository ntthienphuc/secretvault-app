// Public service URL only. No deployment credentials or administrator secrets.
export const API_BASE = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? ""
  : "https://thienphuc12339-secretvault-api.hf.space";
