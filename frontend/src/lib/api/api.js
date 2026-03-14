const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    cache = "no-store",
  } = options;

  const config = {
    method,
    headers: { ...headers },
    credentials: "include",
    cache,
  };

  if (body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error?.message ||
      (response.status === 401 ? "You are not logged in." : "Request failed.");

    throw new ApiError(message, response.status, data);
  }

  return data;
}

export function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function extractApiData(payload, fallback = null) {
  if (payload && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data;
  }

  return payload ?? fallback;
}

export const api = {
  get(path, options = {}) {
    return request(path, { ...options, method: "GET" });
  },

  post(path, body, options = {}) {
    return request(path, { ...options, method: "POST", body });
  },

  patch(path, body, options = {}) {
    return request(path, { ...options, method: "PATCH", body });
  },

  put(path, body, options = {}) {
    return request(path, { ...options, method: "PUT", body });
  },

  delete(path, options = {}) {
    return request(path, { ...options, method: "DELETE" });
  },
};
