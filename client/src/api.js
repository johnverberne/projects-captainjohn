async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Fout ${res.status}`);
  }
  return data;
}

export function me() {
  return request("/api/auth/me");
}

export function login(email, pw) {
  return request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, pw }),
  });
}

export function createLogin(email, reason, name) {
  return request("/api/auth/create-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, reason, name }),
  });
}

export function logout() {
  return request("/api/auth/logout");
}

export function resetLogin(email) {
  const params = new URLSearchParams({ email });
  return request(`/api/auth/reset-login?${params.toString()}`);
}

export function getMeta() {
  return request("/api/projects/meta");
}

export function listProjects() {
  return request("/api/projects");
}

export function getProject(id) {
  return request(`/api/projects/${id}`);
}

export function createProject(formData) {
  return request("/api/projects", { method: "POST", body: formData });
}

export function updateProject(id, formData) {
  return request(`/api/projects/${id}`, { method: "PUT", body: formData });
}

export function addPhotos(id, formData) {
  return request(`/api/projects/${id}/photos`, {
    method: "POST",
    body: formData,
  });
}

export function thumbPhoto(projectId, photoId) {
  return request(`/api/projects/${projectId}/photos/${photoId}/thumb`, {
    method: "POST",
  });
}

export function addStep(projectId, formData) {
  return request(`/api/projects/${projectId}/steps`, {
    method: "POST",
    body: formData,
  });
}

export function updateStep(projectId, stepId, formData) {
  return request(`/api/projects/${projectId}/steps/${stepId}`, {
    method: "PUT",
    body: formData,
  });
}

export function deleteStep(projectId, stepId) {
  return request(`/api/projects/${projectId}/steps/${stepId}`, {
    method: "DELETE",
  });
}

export function addStepPhotos(projectId, stepId, formData) {
  return request(`/api/projects/${projectId}/steps/${stepId}/photos`, {
    method: "POST",
    body: formData,
  });
}

export function thumbStepPhoto(projectId, stepId, photoId) {
  return request(
    `/api/projects/${projectId}/steps/${stepId}/photos/${photoId}/thumb`,
    { method: "POST" }
  );
}

export function deleteProject(id) {
  return request(`/api/projects/${id}`, { method: "DELETE" });
}

export function health() {
  return request("/api/health");
}
