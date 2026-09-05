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

  it("GET /api/config geeft feedbackUrl", async () => {
    const res = await request(app).get("/api/config").expect(200);
    assert.equal(typeof res.body.feedbackUrl, "string");
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
    assert.equal(res.body[0].notes, undefined);
    assert.equal(res.body[0].glasfusionTechnique, undefined);
  });

  it("project zonder hoekje is niet publiek zichtbaar", async () => {
    const Project = require("../../server/model/project.model");
    const atelier = await Project.create({
      title: "Atelierstuk",
      type: "overige",
      notes: "niet in hoekje",
    });
    await seedPublicProject();

    const list = await request(app).get("/api/projects").expect(200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].title, "Publiek testproject");

    await request(app).get(`/api/projects/${atelier._id}`).expect(404);

    const featured = await request(app).get("/api/projects/featured").expect(200);
    assert.equal(featured.body, null);
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
    assert.equal(again.body.length, 0);

    const internal = await agent.get("/api/projects").expect(200);
    assert.equal(internal.body.length, 1);
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

  it("hoofdfoto markeren, herschikken en foto verwijderen", async () => {
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
        {
          filename: "c.jpg",
          originalName: "c.jpg",
          mimetype: "image/jpeg",
          size: 10,
          isCover: false,
        },
      ],
    });
    const firstId = project.photos[0]._id;
    const secondId = project.photos[1]._id;
    const thirdId = project.photos[2]._id;

    const covered = await agent
      .post(`/api/projects/${project._id}/photos/${secondId}/cover`)
      .expect(200);
    assert.equal(covered.body.photos[0]._id, String(secondId));
    assert.equal(covered.body.photos[0].isCover, true);
    assert.equal(covered.body.photos[1]._id, String(firstId));
    assert.equal(covered.body.photos[1].isCover, false);

    const reordered = await agent
      .put(`/api/projects/${project._id}/photos/order`)
      .send({ photoIds: [String(thirdId), String(secondId), String(firstId)] })
      .expect(200);
    assert.equal(reordered.body.photos[0]._id, String(thirdId));
    assert.equal(reordered.body.photos[0].isCover, true);
    assert.equal(reordered.body.photos[1]._id, String(secondId));
    assert.equal(reordered.body.photos[2]._id, String(firstId));

    const deleted = await agent
      .delete(`/api/projects/${project._id}/photos/${thirdId}`)
      .expect(200);
    assert.equal(deleted.body.photos.length, 2);
    assert.equal(deleted.body.photos[0]._id, String(secondId));
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
          isCover: true,
          thumbsUp: 1,
          thumbedBy: ["anon:a"],
        },
      ],
    });
    const high = await Project.create({
      title: "Veel likes",
      type: "overige",
      saleStatus: "showroom",
      photos: [
        {
          filename: "high.jpg",
          originalName: "high.jpg",
          mimetype: "image/jpeg",
          size: 10,
          isCover: true,
          isPublic: true,
          thumbsUp: 3,
          thumbedBy: ["anon:a", "anon:b", "anon:c"],
        },
        {
          filename: "work.jpg",
          originalName: "work.jpg",
          mimetype: "image/jpeg",
          size: 10,
          isPublic: false,
          thumbsUp: 9,
          thumbedBy: ["anon:a"],
        },
      ],
      steps: [
        {
          title: "Stap",
          type: "overige",
          photos: [
            {
              filename: "step.jpg",
              originalName: "step.jpg",
              mimetype: "image/jpeg",
              size: 10,
              thumbsUp: 8,
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

  it("publiek toont geen werkdata, wel verkoopvelden en publieke foto’s", async () => {
    const Project = require("../../server/model/project.model");
    const project = await Project.create({
      title: "Ateliernaam",
      type: "glasfusion",
      glasfusionTechnique: "fuse",
      glasfusionSpeed: "medium",
      oven: "klein",
      notes: "interne notitie",
      firingSchedule: [{ rate: 150, targetTemp: 540, holdMinutes: 20 }],
      saleStatus: "te_koop",
      saleTitle: "Blauw schaaltje",
      saleDescription: "Voor in de vensterbank",
      photos: [
        {
          filename: "cover.jpg",
          originalName: "cover.jpg",
          mimetype: "image/jpeg",
          size: 10,
          isCover: true,
        },
        {
          filename: "work.jpg",
          originalName: "work.jpg",
          mimetype: "image/jpeg",
          size: 10,
          isPublic: false,
        },
        {
          filename: "public.jpg",
          originalName: "public.jpg",
          mimetype: "image/jpeg",
          size: 10,
          isPublic: true,
        },
      ],
      steps: [{ title: "Voet", type: "hout", notes: "werktekst" }],
    });

    const publicView = await request(app)
      .get(`/api/projects/${project._id}`)
      .expect(200);
    assert.equal(publicView.body.title, "Ateliernaam");
    assert.equal(publicView.body.saleTitle, "Blauw schaaltje");
    assert.equal(publicView.body.saleDescription, "Voor in de vensterbank");
    assert.equal(publicView.body.notes, undefined);
    assert.equal(publicView.body.oven, undefined);
    assert.equal(publicView.body.glasfusionTechnique, undefined);
    assert.equal(publicView.body.firingSchedule, undefined);
    assert.equal(publicView.body.steps.length, 0);
    assert.equal(publicView.body.photos.length, 2);
    assert.ok(publicView.body.photos.every((photo) => photo.isCover || photo.isPublic));
  });

  it("oven-code en stookschema opslaan, schema-catalogus hergebruiken", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, pw: TEST_USER.password })
      .expect(200);

    const schema = await agent
      .post("/api/firing-schemas")
      .send({
        name: "Custom medium klein",
        technique: "custom",
        oven: "klein",
        segments: [
          { rate: 150, targetTemp: 540, holdMinutes: 20 },
          { rate: null, targetTemp: 50, holdMinutes: 0 },
        ],
      })
      .expect(201);
    assert.equal(schema.body.name, "Custom medium klein");
    assert.equal(schema.body.oven, "klein");
    assert.equal(schema.body.segments.length, 2);

    const created = await agent
      .post("/api/projects")
      .field("title", "Fuse schaal")
      .field("type", "glasfusion")
      .field("glasfusionTechnique", "custom")
      .field("glasfusionSpeed", "medium")
      .field("oven", "klein")
      .field("firingSchemaId", schema.body._id)
      .field(
        "firingSchedule",
        JSON.stringify([
          { rate: 150, targetTemp: 540, holdMinutes: 20 },
          { rate: "", targetTemp: 50, holdMinutes: 0 },
        ])
      )
      .field("saleStatus", "showroom")
      .field("saleTitle", "Showroom schaal")
      .field("saleDescription", "Te zien in het hoekje")
      .expect(201);

    assert.equal(created.body.oven, "klein");
    assert.equal(created.body.saleTitle, "Showroom schaal");
    assert.equal(created.body.firingSchedule.length, 2);
    assert.equal(created.body.firingSchedule[1].rate, null);

    const listed = await agent.get("/api/firing-schemas").expect(200);
    assert.equal(listed.body.length, 1);
  });

  it("foto als publiek markeren", async () => {
    await agent
      .post("/api/auth/login")
      .send({ email: TEST_USER.email, pw: TEST_USER.password })
      .expect(200);

    const Project = require("../../server/model/project.model");
    const project = await Project.create({
      title: "Foto publiek",
      type: "overige",
      ownerEmail: TEST_USER.email,
      saleStatus: "showroom",
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
          isPublic: false,
        },
      ],
    });
    const workId = project.photos[1]._id;

    const updated = await agent
      .post(`/api/projects/${project._id}/photos/${workId}/public`)
      .send({ isPublic: true })
      .expect(200);
    assert.equal(updated.body.photos[1].isPublic, true);

    const publicView = await request(app)
      .get(`/api/projects/${project._id}`)
      .expect(200);
    assert.equal(publicView.body.photos.length, 2);
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
