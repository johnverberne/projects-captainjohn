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

export function getFeaturedPhoto() {
  return request("/api/projects/featured");
}

export function listProjects({ deleted = false, mine = false } = {}) {
  const params = new URLSearchParams();
  if (deleted) params.set("deleted", "1");
  if (mine) params.set("mine", "1");
  const q = params.toString();
  return request(`/api/projects${q ? `?${q}` : ""}`);
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

async function thumbRequest(url) {
  const res = await fetch(url, {
    credentials: "include",
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409 && data.project) {
    return data.project;
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Fout ${res.status}`);
  }
  return data;
}

export function thumbPhoto(projectId, photoId) {
  return thumbRequest(`/api/projects/${projectId}/photos/${photoId}/thumb`);
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

export function restoreStep(projectId, stepId) {
  return request(`/api/projects/${projectId}/steps/${stepId}/restore`, {
    method: "POST",
  });
}

export function purgeStep(projectId, stepId) {
  return request(`/api/projects/${projectId}/steps/${stepId}/permanent`, {
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
  return thumbRequest(
    `/api/projects/${projectId}/steps/${stepId}/photos/${photoId}/thumb`
  );
}

export function deleteProject(id) {
  return request(`/api/projects/${id}`, { method: "DELETE" });
}

export function restoreProject(id) {
  return request(`/api/projects/${id}/restore`, { method: "POST" });
}

export function purgeProject(id) {
  return request(`/api/projects/${id}/permanent`, { method: "DELETE" });
}

export function health() {
  return request("/api/health");
}
