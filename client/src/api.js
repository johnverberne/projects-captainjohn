async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Fout ${res.status}`);
  }
  return data;
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

export function deleteProject(id) {
  return request(`/api/projects/${id}`, { method: "DELETE" });
}

export function health() {
  return request("/api/health");
}
