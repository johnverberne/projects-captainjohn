import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import NewProjectView from "./views/NewProjectView.vue";
import ProjectDetailView from "./views/ProjectDetailView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/nieuw", name: "new", component: NewProjectView },
    { path: "/project/:id", name: "detail", component: ProjectDetailView },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
