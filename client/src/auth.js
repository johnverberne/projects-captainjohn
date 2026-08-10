import { ref, computed } from "vue";
import {
  login as apiLogin,
  createLogin as apiCreateLogin,
  logout as apiLogout,
  me,
} from "./api";

const user = ref(null);
const ready = ref(false);
const returnUrl = ref("/bewerken");

const ADMIN_EMAIL = "john.verberne@gmail.com";

export function useAuth() {
  const isLoggedIn = computed(() => Boolean(user.value));
  const isAdmin = computed(() => {
    if (!user.value) return false;
    const email = String(user.value.email || "").toLowerCase();
    const roles = user.value.roles || [];
    return email === ADMIN_EMAIL || roles.includes("admin");
  });

  async function refresh() {
    try {
      const data = await me();
      user.value = data.login ? data.user : null;
    } catch {
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(email, password) {
    const data = await apiLogin(email, password);
    user.value = data.user;
    return data;
  }

  async function requestAccess(email, reason, name) {
    return apiCreateLogin(email, reason, name);
  }

  async function logout() {
    try {
      await apiLogout();
    } finally {
      user.value = null;
    }
  }

  return {
    user,
    ready,
    returnUrl,
    isLoggedIn,
    isAdmin,
    refresh,
    login,
    requestAccess,
    logout,
  };
}
