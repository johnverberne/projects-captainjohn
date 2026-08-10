import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import NewProjectView from "./views/NewProjectView.vue";
import ProjectDetailView from "./views/ProjectDetailView.vue";
import AuthView from "./views/AuthView.vue";
import { useAuth } from "./auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/auth",
      name: "auth",
      component: AuthView,
      meta: { guest: true },
    },
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: "/nieuw",
      name: "new",
      component: NewProjectView,
      meta: { requiresAuth: true },
    },
    {
      path: "/project/:id",
      name: "detail",
      component: ProjectDetailView,
      meta: { requiresAuth: true },
    },
  ],
  scrollBehavior() {
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
    return { path: "/auth", replace: true };
  }

  if (to.meta.guest && auth.isLoggedIn.value) {
    return { path: "/", replace: true };
  }

  return true;
});

export default router;
