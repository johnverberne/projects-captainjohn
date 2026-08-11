const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const {
  connectTestDb,
  clearDb,
  seedUser,
  seedPublicProject,
  disconnectTestDb,
  TEST_USER,
} = require("../helpers/db");
const { getTestApp } = require("../helpers/app");

describe("API: health, auth, projects", () => {
  let app;
  let agent;

  before(async () => {
    await connectTestDb();
    app = await getTestApp();
  });

  beforeEach(async () => {
    await clearDb();
    await seedUser();
    agent = request.agent(app);
  });

  after(async () => {
    await disconnectTestDb();
  });

  it("GET /api/health is ok", async () => {
    const res = await request(app).get("/api/health").expect(200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.mongo, "connected");
  });

  it("login en /api/auth/me", async () => {
    const login = await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, pw: TEST_USER.password })
      .expect(200);
    assert.ok(login.body.user);
    assert.equal(login.body.user.email, TEST_USER.email);

    const me = await agent.get("/api/auth/me").expect(200);
    assert.equal(me.body.login, true);
    assert.equal(me.body.user.email, TEST_USER.email);
  });

  it("publieke projectlijst zonder login", async () => {
    await seedPublicProject();
    const res = await request(app).get("/api/projects").expect(200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].title, "Publiek testproject");
  });

  it("project aanmaken vereist login", async () => {
    await request(app)
      .post("/api/projects")
      .field("title", "Geheim")
      .field("type", "overige")
      .expect(401);
  });

  it("ingelogd project aanmaken, soft-deleten en herstellen", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, pw: TEST_USER.password })
      .expect(200);

    const created = await agent
      .post("/api/projects")
      .field("title", "Keramiek kom")
      .field("type", "keramiek")
      .field("notes", "test")
      .field(
        "labels",
        JSON.stringify([{ name: "Oven", color: "#b85c38" }])
      )
      .expect(201);

    assert.equal(created.body.title, "Keramiek kom");
    assert.equal(created.body.labels.length, 1);

    const id = created.body._id;
    await agent.delete(`/api/projects/${id}`).expect(200);

    const publicList = await request(app).get("/api/projects").expect(200);
    assert.equal(publicList.body.length, 0);

    const trash = await agent.get("/api/projects?deleted=1").expect(200);
    assert.equal(trash.body.length, 1);

    const restored = await agent.post(`/api/projects/${id}/restore`).expect(200);
    assert.equal(restored.body.deletedAt, null);

    const again = await request(app).get("/api/projects").expect(200);
    assert.equal(again.body.length, 1);
  });

  it("stap soft-deleten en terugzetten", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, pw: TEST_USER.password })
      .expect(200);

    const project = await agent
      .post("/api/projects")
      .field("title", "Met stap")
      .field("type", "hout")
      .expect(201);

    const withStep = await agent
      .post(`/api/projects/${project.body._id}/steps`)
      .field("title", "Schuren")
      .field("type", "hout")
      .expect(201);

    const stepId = withStep.body.steps[0]._id;
    const deleted = await agent
      .delete(`/api/projects/${project.body._id}/steps/${stepId}`)
      .expect(200);

    assert.ok(deleted.body.steps[0].deletedAt);

    const restored = await agent
      .post(`/api/projects/${project.body._id}/steps/${stepId}/restore`)
      .expect(200);
    assert.equal(restored.body.steps[0].deletedAt, null);
  });

  it("duimpje maar één keer per sessie", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, pw: TEST_USER.password })
      .expect(200);

    // Minimal fake photo metadata without GridFS file (thumb only touches counts)
    const Project = require("../../server/model/project.model");
    const project = await Project.create({
      title: "Foto project",
      type: "overige",
      ownerEmail: TEST_USER.email,
      photos: [
        {
          filename: "x.jpg",
          originalName: "x.jpg",
          mimetype: "image/jpeg",
          size: 10,
          thumbsUp: 0,
          thumbedBy: [],
        },
      ],
    });
    const photoId = project.photos[0]._id;

    const first = await agent
      .post(`/api/projects/${project._id}/photos/${photoId}/thumb`)
      .expect(200);
    assert.equal(first.body.photos[0].thumbsUp, 1);
    assert.equal(first.body.photos[0].thumbedByMe, true);

    await agent
      .post(`/api/projects/${project._id}/photos/${photoId}/thumb`)
      .expect(409);
  });

  it("hoofdfoto markeren en foto verwijderen", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, pw: TEST_USER.password })
      .expect(200);

    const Project = require("../../server/model/project.model");
    const project = await Project.create({
      title: "Cover project",
      type: "overige",
      ownerEmail: TEST_USER.email,
      photos: [
        {
          filename: "a.jpg",
          originalName: "a.jpg",
          mimetype: "image/jpeg",
          size: 10,
          isCover: true,
        },
        {
          filename: "b.jpg",
          originalName: "b.jpg",
          mimetype: "image/jpeg",
          size: 10,
          isCover: false,
        },
      ],
    });
    const firstId = project.photos[0]._id;
    const secondId = project.photos[1]._id;

    const covered = await agent
      .post(`/api/projects/${project._id}/photos/${secondId}/cover`)
      .expect(200);
    assert.equal(covered.body.photos.find((p) => p._id === String(secondId)).isCover, true);
    assert.equal(covered.body.photos.find((p) => p._id === String(firstId)).isCover, false);

    const deleted = await agent
      .delete(`/api/projects/${project._id}/photos/${secondId}`)
      .expect(200);
    assert.equal(deleted.body.photos.length, 1);
    assert.equal(deleted.body.photos[0]._id, String(firstId));
    assert.equal(deleted.body.photos[0].isCover, true);
  });

  it("featured foto is die met de meeste duimpjes", async () => {
    const Project = require("../../server/model/project.model");
    const low = await Project.create({
      title: "Weinig likes",
      type: "overige",
      photos: [
        {
          filename: "low.jpg",
          originalName: "low.jpg",
          mimetype: "image/jpeg",
          size: 10,
          thumbsUp: 1,
          thumbedBy: ["anon:a"],
        },
      ],
    });
    const high = await Project.create({
      title: "Veel likes",
      type: "overige",
      photos: [
        {
          filename: "high.jpg",
          originalName: "high.jpg",
          mimetype: "image/jpeg",
          size: 10,
          thumbsUp: 3,
          thumbedBy: ["anon:a", "anon:b", "anon:c"],
        },
      ],
      steps: [
        {
          title: "Stap",
          photos: [
            {
              filename: "step.jpg",
              originalName: "step.jpg",
              mimetype: "image/jpeg",
              size: 10,
              thumbsUp: 2,
              thumbedBy: ["anon:a", "anon:b"],
            },
          ],
        },
      ],
    });

    const featured = await request(app).get("/api/projects/featured").expect(200);
    assert.equal(featured.body.projectId, String(high._id));
    assert.equal(featured.body.projectTitle, "Veel likes");
    assert.equal(featured.body.photo.thumbsUp, 3);
    assert.equal(
      featured.body.photo.url,
      `/api/projects/${high._id}/photos/${high.photos[0]._id}/file`
    );
    assert.notEqual(featured.body.projectId, String(low._id));
  });

  it("API docs vereist login", async () => {
    await request(app)
      .get("/api")
      .set("Accept", "text/html")
      .expect(302);
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, pw: TEST_USER.password })
      .expect(200);
    const docs = await agent.get("/api?format=json").expect(200);
    assert.equal(docs.body.ok, true);
    assert.ok(Array.isArray(docs.body.groups));
  });
});
