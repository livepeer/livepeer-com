import serverPromise from "../test-server";
import { TestClient, clearDatabase } from "../test-helpers";

let server;
let mockAdminUser;
let mockNonAdminUser;
let postMockStream;
let mockWebhook;
// jest.setTimeout(70000)

beforeAll(async () => {
  server = await serverPromise;
  postMockStream = require("./wowza-hydrate.test-data.json").stream;
  delete postMockStream.id;
  delete postMockStream.kind;
  postMockStream.presets = ["P360p30fps16x9", "P144p30fps16x9"];
  postMockStream.renditions = {
    bbb_360p:
      "/stream/305b9fa7-c6b3-4690-8b2e-5652a2556524/P360p30fps16x9.m3u8",
    thesource_bbb: "/stream/305b9fa7-c6b3-4690-8b2e-5652a2556524/source.m3u8",
    random_prefix_bbb_160p:
      "/stream/305b9fa7-c6b3-4690-8b2e-5652a2556524/P144p30fps16x9.m3u8",
  };
  postMockStream.wowza.streamNameGroups = [
    {
      name: "bbb_all",
      renditions: ["thesource_bbb", "bbb_360p", "random_prefix_bbb_160p"],
    },
    {
      name: "bbb_mobile",
      renditions: ["random_prefix_bbb_160p"],
    },
  ];

  mockAdminUser = {
    email: "user_admin@gmail.com",
    password: "x".repeat(64),
  };

  mockNonAdminUser = {
    email: "user_non_admin@gmail.com",
    password: "y".repeat(64),
  };

  mockWebhook = {
    id: "mock_webhook",
    name: "test webhook 1",
    kind: "webhook",
    createdAt: Date.now(),
    event: "streamStarted",
    url: "https://winter-darkness-88ea.livepeer.workers.dev/",
    // url: 'https://livepeer.com/'
  };
});

async function setupUsers(server) {
  const client = new TestClient({
    server,
  });
  // setting up admin user and token
  const userRes = await client.post(`/user/`, { ...mockAdminUser });
  let adminUser = await userRes.json();

  let tokenRes = await client.post(`/user/token`, { ...mockAdminUser });
  const adminToken = await tokenRes.json();
  client.jwtAuth = adminToken["token"];

  const user = await server.store.get(`user/${adminUser.id}`, false);
  adminUser = { ...user, admin: true, emailValid: true };
  await server.store.replace(adminUser);

  const resNonAdmin = await client.post(`/user/`, { ...mockNonAdminUser });
  let nonAdminUser = await resNonAdmin.json();

  tokenRes = await client.post(`/user/token`, { ...mockNonAdminUser });
  const nonAdminToken = await tokenRes.json();

  const nonAdminUserRes = await server.store.get(
    `user/${nonAdminUser.id}`,
    false
  );
  nonAdminUser = { ...nonAdminUserRes, emailValid: true };
  await server.store.replace(nonAdminUser);
  return { client, adminUser, adminToken, nonAdminUser, nonAdminToken };
}

describe("controllers/webhook", () => {
  describe("CRUD", () => {
    let client,
      adminUser,
      adminToken,
      nonAdminUser,
      nonAdminToken,
      generatedWebhook,
      generatedWebhook2,
      generatedWebhookNonAdmin;

    beforeAll(async () => {
      ({
        client,
        adminUser,
        adminToken,
        nonAdminUser,
        nonAdminToken,
      } = await setupUsers(server));
    });

    afterAll(async () => {
      await clearDatabase(server);
    });

    it("create a webhook", async () => {
      // console.log('mockWebhook: ', mockWebhook)
      let res = await client.post("/webhook", { ...mockWebhook });
      let resJson = await res.json();
      console.log("webhook body: ", resJson);
      expect(res.status).toBe(201);
      expect(resJson.blocking).toBe(true);
      generatedWebhook = resJson;
      res = await client.post("/webhook", {
        ...mockWebhook,
        name: "test 2",
        blocking: false,
      });
      resJson = await res.json();
      expect(resJson.blocking).toBe(false);
      console.log("webhook body: ", resJson);
      expect(res.status).toBe(201);
      expect(resJson.name).toBe("test 2");
      generatedWebhook2 = resJson;

      client.jwtAuth = nonAdminToken["token"];
      res = await client.post("/webhook", {
        ...mockWebhook,
        name: "test non admin",
      });
      resJson = await res.json();
      console.log("webhook body: ", resJson);
      expect(res.status).toBe(201);
      expect(resJson.name).toBe("test non admin");
      generatedWebhookNonAdmin = resJson;
      client.jwtAuth = adminToken["token"];
    });

    it("get webhook info", async () => {
      const res = await client.get(`/webhook/${generatedWebhook.id}`);
      const resJson = await res.json();
      expect(res.status).toBe(200);
      expect(resJson.id).toEqual(generatedWebhook.id);
      expect(resJson.userId).toEqual(generatedWebhook.userId);
    });

    it("get webhooks list", async () => {
      const res = await client.get(`/webhook?limit=1`);
      const resJson = await res.json();
      expect(res.status).toBe(200);
      expect(res.headers.get("link")).toEqual(
        expect.stringContaining("cursor=")
      );
      expect(resJson).toHaveLength(1);
      expect(resJson[0].userId).toEqual(generatedWebhook.userId);
      expect(
        [generatedWebhook2.id, generatedWebhook.id].includes(resJson[0].id)
      ).toBe(true);
    });

    it("get webhooks list all", async () => {
      const res = await client.get(`/webhook?allUsers=1`);
      const resJson = await res.json();
      expect(res.status).toBe(200);
      expect(resJson).toHaveLength(3);
      expect(resJson.map((wh) => wh.name).includes("test non admin")).toBe(
        true
      );
    });

    it("update a webhook", async () => {
      let modifiedHook = { ...generatedWebhook };
      modifiedHook.name = "modified_name";
      const res = await client.put(`/webhook/${modifiedHook.id}`, modifiedHook);
      const resJson = await res.json();
      expect(res.status).toBe(200);
      expect(resJson.id).toEqual(generatedWebhook.id);
    });

    it("delete a webhook", async () => {
      const res = await client.delete(`/webhook/${generatedWebhook.id}`);
      expect(res.status).toBe(204);

      client.jwtAuth = nonAdminToken.token;
      const res2 = await client.get(`/webhook/${generatedWebhook.id}`);
      const resJson2 = await res2.json();

      expect(res2.status).toBe(404);
    });
  });

  describe("webhook trigger", () => {
    let client,
      adminUser,
      adminToken,
      nonAdminUser,
      nonAdminToken,
      generatedWebhook;

    beforeAll(async () => {
      ({
        client,
        adminUser,
        adminToken,
        nonAdminUser,
        nonAdminToken,
      } = await setupUsers(server));
    });

    afterAll(async () => {
      await clearDatabase(server);
    });

    it("trigger webhook", async () => {
      // create webhook
      const webhookRes = await client.post("/webhook", { ...mockWebhook });
      let webhookResJson = await webhookRes.json();
      expect(webhookRes.status).toBe(201);
      generatedWebhook = webhookResJson;

      const webhookRes2 = await client.post("/webhook", { ...mockWebhook });
      let webhookResJson2 = await webhookRes2.json();
      expect(webhookRes2.status).toBe(201);
      // generatedWebhook = webhookResJson

      // create a stream object
      const now = Date.now();
      postMockStream.name = "eli_is_cool"; // :D
      const res = await client.post("/stream", { ...postMockStream });
      expect(res.status).toBe(201);
      const stream = await res.json();
      expect(stream.id).toBeDefined();
      expect(stream.kind).toBe("stream");
      expect(stream.name).toBe("eli_is_cool");
      expect(stream.createdAt).toBeGreaterThanOrEqual(now);
      const document = await server.store.get(`stream/${stream.id}`);
      expect(server.db.stream.addDefaultFields(document)).toEqual(stream);

      // trigger
      const setActiveRes = await client.put(`/stream/${stream.id}/setactive`, {
        active: true,
      });
      expect(setActiveRes).toBeDefined();
      expect(setActiveRes.status).toBe(204);
      // const setActiveResJson = await setActiveRes.json()
      // expect(setActiveResJson).toBeDefined()
    }, 20000);

    it("trigger webhook with localIP", async () => {
      await clearDatabase(server);
      ({
        client,
        adminUser,
        adminToken,
        nonAdminUser,
        nonAdminToken,
      } = await setupUsers(server));

      let localWebhook = { ...mockWebhook };
      localWebhook.url = "192.168.1.1";
      console.log("localwebhook: ", localWebhook);
      // create webhook
      const webhookRes = await client.post("/webhook", { ...localWebhook });
      let webhookResJson = await webhookRes.json();
      console.log("webhook created: ", webhookResJson);
      expect(webhookRes.status).toBe(406);
    });
  });
});
