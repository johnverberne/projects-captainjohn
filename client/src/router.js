import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import NewProjectView from "./views/NewProjectView.vue";
import ProjectDetailView from "./views/ProjectDetailView.vue";
import SalesCornerView from "./views/SalesCornerView.vue";
import AuthView from "./views/AuthView.vue";
import { useAuth } from "./auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { public: true, wide: true },
    },
    {
      path: "/verkoop",
      name: "sales",
      component: SalesCornerView,
      meta: { public: true, allowAuthed: true, wide: true },
    },
    {
      path: "/project/:id",
      name: "detail",
      component: ProjectDetailView,
      meta: { public: true },
    },
    {
      path: "/inloggen",
      name: "login",
      component: AuthView,
      meta: { guest: true },
    },
    {
      path: "/auth",
      redirect: (to) => ({
        path: "/inloggen",
        query: to.query,
      }),
    },
    {
      path: "/bewerken",
      name: "edit-home",
      component: HomeView,
      meta: { requiresAuth: true, editMode: true, wide: true },
    },
    {
      path: "/bewerken/verkoop",
      name: "edit-sales",
      component: SalesCornerView,
      meta: { requiresAuth: true, editMode: true, wide: true },
    },
    {
      path: "/bewerken/nieuw",
      name: "edit-new",
      component: NewProjectView,
      meta: { requiresAuth: true, editMode: true },
    },
    {
      path: "/bewerken/project/:id",
      name: "edit-detail",
      component: ProjectDetailView,
      meta: { requiresAuth: true, editMode: true },
    },
    {
      path: "/nieuw",
      redirect: "/bewerken/nieuw",
    },
  ],
  scrollBehavior(to, from) {
    // Filters en zoeken schrijven naar de query; dan niet naar boven springen.
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  const auth = useAuth();
  if (!auth.ready.value) {
    await auth.refresh();
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn.value) {
    auth.returnUrl.value = to.fullPath;
    return { path: "/inloggen", query: { return: to.fullPath }, replace: true };
  }

  if (to.meta.guest && auth.isLoggedIn.value) {
    const ret = String(to.query.return || auth.returnUrl.value || "/bewerken").trim();
    const target = ret.startsWith("/") && !ret.startsWith("//") ? ret : "/bewerken";
    if (target.startsWith("/api")) {
      window.location.replace(target);
      return false;
    }
    return { path: target, replace: true };
  }

  // Ingelogd: altijd de bewerk-kant, nooit de publieke routes
  if (auth.isLoggedIn.value && to.meta.public && !to.meta.allowAuthed) {
    if (to.name === "detail") {
      return { path: `/bewerken/project/${to.params.id}`, replace: true };
    }
    if (to.name === "sales") {
      return { path: "/bewerken/verkoop", replace: true };
    }
    return { path: "/bewerken", replace: true };
  }

  return true;
});

export default router;
