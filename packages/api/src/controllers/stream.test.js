import serverPromise from "../test-server";
import { TestClient, clearDatabase } from "../test-helpers";
import uuid from "uuid/v4";

let server;
let mockStore;
let mockUser;
let mockAdminUser;
let mockNonAdminUser;
let postMockStream;
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
  postMockStream.objectStoreId = "mock_store";
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

  mockUser = {
    email: `mock_user@gmail.com`,
    password: "z".repeat(64),
  };

  mockAdminUser = {
    email: "user_admin@gmail.com",
    password: "x".repeat(64),
  };

  mockNonAdminUser = {
    email: "user_non_admin@gmail.com",
    password: "y".repeat(64),
  };

  mockStore = {
    id: "mock_store",
    url: "https+s3://example.com/bucket-name",
    userId: mockAdminUser.id,
    kind: "object-store",
  };
});

afterEach(async () => {
  await clearDatabase(server);
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

describe("controllers/stream", () => {
  describe("basic CRUD with JWT authorization", () => {
    let client, adminUser, adminToken, nonAdminUser, nonAdminToken;

    beforeEach(async () => {
      ({
        client,
        adminUser,
        adminToken,
        nonAdminUser,
        nonAdminToken,
      } = await setupUsers(server));
    });

    it("should not get all streams without admin authorization", async () => {
      client.jwtAuth = "";
      for (let i = 0; i < 10; i += 1) {
        const document = {
          id: uuid(),
          kind: "stream",
        };
        await server.store.create(document);
        const res = await client.get(`/stream/${document.id}`);
        expect(res.status).toBe(403);
      }
      const res = await client.get("/stream");
      expect(res.status).toBe(403);
    });

    it("should get all streams with admin authorization", async () => {
      for (let i = 0; i < 5; i += 1) {
        const document = {
          id: uuid(),
          kind: "stream",
          deleted: i > 3 ? true : undefined,
        };
        await server.store.create(document);
        const res = await client.get(`/stream/${document.id}`);
        const stream = await res.json();
        expect(stream).toEqual(server.db.stream.addDefaultFields(document));
      }

      const res = await client.get("/stream");
      expect(res.status).toBe(200);
      const streams = await res.json();
      expect(streams.length).toEqual(4);
      const resAll = await client.get("/stream?all=1");
      expect(resAll.status).toBe(200);
      const streamsAll = await resAll.json();
      expect(streamsAll.length).toEqual(5);
    });

    it("should not get empty list with next page", async () => {
      const sources = [];
      for (let i = 0; i < 5; i += 1) {
        const document = {
          id: i + uuid(), // object should be sorted for this test to work as intended
          kind: "stream",
          deleted: i < 3 ? true : undefined,
        };
        await server.store.create(document);
        const res = await client.get(`/stream/${document.id}`);
        const stream = await res.json();
        expect(stream).toEqual(server.db.stream.addDefaultFields(document));
        sources.push(stream);
      }

      const res = await client.get("/stream?limit=3");
      expect(res.status).toBe(200);
      const streams = await res.json();
      expect(streams.length).toEqual(2);
      sources[3].user = {};
      sources[4].user = {};
      expect(streams[0]).toStrictEqual(sources[3]);
      expect(streams[1]).toStrictEqual(sources[4]);
    });

    it("should get some of the streams & get a working next Link", async () => {
      for (let i = 0; i < 13; i += 1) {
        const document = {
          id: uuid(),
          kind: "stream",
        };
        await server.store.create(document);
        const res = await client.get(`/stream/${document.id}`);
        const stream = await res.json();
        expect(stream).toEqual(server.db.stream.addDefaultFields(document));
      }
      const res = await client.get(`/stream?limit=11`);
      const streams = await res.json();
      expect(res.headers._headers.link).toBeDefined();
      expect(res.headers._headers.link.length).toBe(1);
      expect(streams.length).toEqual(11);
    });

    it("should reject streams with object stores that don not exist", async () => {
      const res = await client.post("/stream", { ...postMockStream });
      expect(res.status).toBe(400);
    });

    it("should create a stream", async () => {
      await server.store.create(mockStore);
      const now = Date.now();
      const res = await client.post("/stream", { ...postMockStream });
      expect(res.status).toBe(201);
      const stream = await res.json();
      expect(stream.id).toBeDefined();
      expect(stream.kind).toBe("stream");
      expect(stream.name).toBe("test_stream");
      expect(stream.createdAt).toBeGreaterThanOrEqual(now);
      const document = await server.store.get(`stream/${stream.id}`);
      expect(server.db.stream.addDefaultFields(document)).toEqual(stream);
    });

    it("should create a stream, delete it, and error when attempting additional detele or replace", async () => {
      await server.store.create(mockStore);
      const res = await client.post("/stream", { ...postMockStream });
      expect(res.status).toBe(201);
      const stream = await res.json();
      expect(stream.id).toBeDefined();

      const document = await server.store.get(`stream/${stream.id}`);
      expect(server.db.stream.addDefaultFields(document)).toEqual(stream);

      await server.store.delete(`stream/${stream.id}`);
      const deleted = await server.store.get(`stream/${stream.id}`);
      expect(deleted).toBe(null);

      // it should return a NotFound Error when trying to delete a record that doesn't exist
      try {
        await server.store.delete(`stream/${stream.id}`);
      } catch (err) {
        expect(err.status).toBe(404);
      }

      // it should return a NotFound Error when trying to replace a record that doesn't exist
      try {
        await server.store.replace(document);
      } catch (err) {
        expect(err.status).toBe(404);
      }
    });

    it("should get own streams with non-admin user", async () => {
      const source = [];
      for (let i = 0; i < 9; i += 1) {
        const document = {
          id: i + uuid(), // sort objects
          kind: "stream",
          userId: i < 7 ? nonAdminUser.id : undefined,
          deleted: i < 3 ? true : undefined,
        };
        await server.store.create(document);
        const res = await client.get(`/stream/${document.id}`);
        expect(res.status).toBe(200);
        source.push(await res.json());
      }
      client.jwtAuth = nonAdminToken["token"];

      const res = await client.get(`/stream/user/${nonAdminUser.id}?limit=3`);
      expect(res.status).toBe(200);
      const streams = await res.json();
      expect(streams.length).toEqual(3);
      expect(streams[0]).toEqual(source[3]);
      expect(streams[0].userId).toEqual(nonAdminUser.id);
      expect(res.headers._headers.link).toBeDefined();
      expect(res.headers._headers.link.length).toBe(1);
      const [nextLink] = res.headers._headers.link[0].split(">");
      const si = nextLink.indexOf(`/stream/user/`);
      const nextRes = await client.get(nextLink.slice(si));
      expect(nextRes.status).toBe(200);
      const nextStreams = await nextRes.json();
      expect(nextStreams.length).toEqual(1);
      expect(nextStreams[0]).toEqual(source[6]);
      expect(nextStreams[0].userId).toEqual(nonAdminUser.id);
    });

    it("should not get streams with non-admin user", async () => {
      for (let i = 0; i < 5; i += 1) {
        const document = {
          id: uuid(),
          kind: "stream",
          userId: i < 3 ? nonAdminUser.id : undefined,
        };
        await server.store.create(document);
        const res = await client.get(`/stream/${document.id}`);
        expect(res.status).toBe(200);
      }
      client.jwtAuth = nonAdminToken["token"];

      const res = await client.get(`/stream`);
      expect(res.status).toBe(200);
      const streams = await res.json();
      expect(Array.isArray(streams)).toBe(true);
      expect(streams).toHaveLength(3);
      expect(streams[0].userId).toBe(nonAdminUser.id);
    });

    it("should not accept empty body for creating a stream", async () => {
      const res = await client.post("/stream");
      expect(res.status).toBe(422);
    });

    it("should not accept additional properties for creating a stream", async () => {
      const postMockLivepeerStream = JSON.parse(JSON.stringify(postMockStream));
      postMockLivepeerStream.livepeer = "livepeer";
      const res = await client.post("/stream", { ...postMockLivepeerStream });
      expect(res.status).toBe(422);
      const stream = await res.json();
      expect(stream.id).toBeUndefined();
    });
  });

  describe("stream endpoint with api key", () => {
    let client, adminUser, adminToken, nonAdminUser, nonAdminToken;
    const adminApiKey = uuid();
    const nonAdminApiKey = uuid();

    beforeEach(async () => {
      ({
        client,
        adminUser,
        adminToken,
        nonAdminUser,
        nonAdminToken,
      } = await setupUsers(server));

      await server.store.create({
        id: adminApiKey,
        kind: "api-token",
        userId: adminUser.id,
      });

      await server.store.create({
        id: nonAdminApiKey,
        kind: "api-token",
        userId: nonAdminUser.id,
      });

      for (let i = 0; i < 5; i += 1) {
        const document = {
          id: uuid(),
          kind: "stream",
          userId: i < 3 ? nonAdminUser.id : undefined,
        };
        await server.store.create(document);
        const res = await client.get(`/stream/${document.id}`);
        expect(res.status).toBe(200);
      }
      client.jwtAuth = "";
    });

    it("should get own streams", async () => {
      client.apiKey = nonAdminApiKey;
      let res = await client.get(`/stream/user/${nonAdminUser.id}`);
      expect(res.status).toBe(200);
      const streams = await res.json();
      expect(streams.length).toEqual(3);
      expect(streams[0].userId).toEqual(nonAdminUser.id);
    });

    it("should delete stream", async () => {
      client.apiKey = nonAdminApiKey;
      let res = await client.get(`/stream/user/${nonAdminUser.id}`);
      expect(res.status).toBe(200);
      const streams = await res.json();
      expect(streams.length).toEqual(3);
      expect(streams[0].userId).toEqual(nonAdminUser.id);
      let dres = await client.delete(`/stream/${streams[0].id}`);
      expect(dres.status).toBe(204);
      let get2 = await client.delete(`/stream/${streams[0].id}`);
      expect(get2.status).toBe(404);
      let res2 = await client.get(`/stream/user/${nonAdminUser.id}`);
      expect(res2.status).toBe(200);
      const streams2 = await res2.json();
      expect(streams2.length).toEqual(2);
    });

    it("should not get others streams", async () => {
      client.apiKey = nonAdminApiKey;
      let res = await client.get(`/stream/user/otherUserId`);
      expect(res.status).toBe(403);
    });
  });

  describe("webhooks", () => {
    let stream;
    let data;
    let res;
    let client;

    beforeEach(async () => {
      client = new TestClient({
        server,
      });
      await server.store.create(mockStore);
      stream = {
        id: uuid(),
        kind: "stream",
        presets: ["P720p30fps16x9", "P360p30fps4x3", "P144p30fps16x9"],
        objectStoreId: mockStore.id,
      };
      await server.store.create(stream);
    });

    const happyCases = [
      `rtmp://56.13.68.32/live/STREAM_ID`,
      `http://localhost/live/STREAM_ID/12354.ts`,
      `https://example.com/live/STREAM_ID/0.ts`,
      `/live/STREAM_ID/99912938429430820984294083.ts`,
    ];

    for (let url of happyCases) {
      it(`should succeed for ${url}`, async () => {
        url = url.replace("STREAM_ID", stream.id);
        res = await client.post("/stream/hook", { url });
        data = await res.json();
        expect(data.presets).toEqual(stream.presets);
        expect(data.objectStore).toEqual(mockStore.url);
      });
    }

    const sadCases = [
      [422, `rtmp://localhost/live/foo/bar/extra`],
      [422, `http://localhost/live/foo/bar/extra/extra2/13984.ts`],
      [422, "nonsense://localhost/live"],
      [401, `https://localhost/live`],
      [404, `https://localhost/notlive/STREAM_ID/1324.ts`],
      [404, `rtmp://localhost/notlive/STREAM_ID`],
      [404, `rtmp://localhost/live/nonexists`],
      [404, `https://localhost/live/notexists/1324.ts`],
    ];

    for (let [status, url] of sadCases) {
      it(`should return ${status} for ${url}`, async () => {
        url = url.replace("STREAM_ID", stream.id);
        res = await client.post("/stream/hook", { url });
        expect(res.status).toBe(status);
      });
    }

    it("should reject missing urls", async () => {
      res = await client.post("/stream/hook", {});
      expect(res.status).toBe(422);
    });
  });

  describe("profiles", () => {
    let stream;
    let fractionalStream;
    let gopStream;
    let profileStream;
    let client, adminUser, adminToken, nonAdminUser, nonAdminToken;
    beforeEach(async () => {
      ({
        client,
        adminUser,
        adminToken,
        nonAdminUser,
        nonAdminToken,
      } = await setupUsers(server));
      client.jwtAuth = nonAdminToken["token"];

      await server.store.create(mockStore);
      stream = {
        kind: "stream",
        name: "test stream",
        profiles: [
          {
            name: "1080p",
            bitrate: 6000000,
            fps: 30,
            width: 1920,
            height: 1080,
          },
          {
            name: "720p",
            bitrate: 2000000,
            fps: 30,
            width: 1280,
            height: 720,
          },
          {
            name: "360p",
            bitrate: 500000,
            fps: 30,
            width: 640,
            height: 360,
          },
        ],
      };
      fractionalStream = {
        ...stream,
        profiles: [
          {
            name: "1080p29.97",
            bitrate: 6000000,
            fps: 30000,
            fpsDen: 1001,
            width: 1920,
            height: 1080,
          },
        ],
      };
      gopStream = {
        ...stream,
        profiles: [
          {
            ...stream.profiles[0],
            gop: "2.0",
          },
          {
            ...stream.profiles[1],
            gop: "0",
          },
          {
            ...stream.profiles[2],
            gop: "intra",
          },
        ],
      };

      profileStream = {
        ...stream,
        profiles: [
          {
            ...stream.profiles[0],
            profile: "H264Baseline",
          },
          {
            ...stream.profiles[1],
            profile: "H264High",
          },
          {
            ...stream.profiles[2],
            profile: "H264ConstrainedHigh",
          },
        ],
      };
    });

    it("should handle profiles, including fractional fps, gops, and h264 profiles", async () => {
      for (const testStream of [
        stream,
        fractionalStream,
        gopStream,
        profileStream,
      ]) {
        const res = await client.post("/stream", testStream);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.profiles).toEqual(testStream.profiles);
        const hookRes = await client.post("/stream/hook", {
          url: `https://example.com/live/${data.id}/0.ts`,
        });
        expect(hookRes.status).toBe(200);
        const hookData = await hookRes.json();
        expect(hookData.profiles).toEqual(testStream.profiles);
      }
    });

    it("should reject profiles we do not have", async () => {
      const badStream = {
        ...profileStream,
        profiles: [...profileStream.profiles],
      };
      badStream.profiles[0] = {
        ...profileStream.profiles[0],
        profile: "VP8OrSomethingIDK",
      };
      const res = await client.post("/stream", badStream);
      expect(res.status).toBe(422);
    });
  });

  describe("user sessions", () => {
    let client, adminUser, adminToken, nonAdminUser, nonAdminToken;

    beforeEach(async () => {
      ({
        client,
        adminUser,
        adminToken,
        nonAdminUser,
        nonAdminToken,
      } = await setupUsers(server));
    });

    it("should join sessions", async () => {
      await server.store.create(mockStore);
      // create parent stream
      let res = await client.post("/stream", smallStream);
      expect(res.status).toBe(201);
      const parent = await res.json();
      expect(parent.record).toEqual(true);
      // create session
      res = await client.post(`/stream/${parent.id}/stream`, {
        ...smallStream,
        name: "sess1",
      });
      expect(res.status).toBe(201);
      let sess1 = await res.json();
      expect(sess1.record).toEqual(true);
      expect(sess1.parentId).toEqual(parent.id);
      // add some usage and lastSeen
      let now = Date.now();
      await server.db.stream.update(sess1.id, {
        lastSeen: now,
        sourceBytes: 1,
        transcodedBytes: 2,
        sourceSegments: 3,
        transcodedSegments: 4,
        sourceSegmentsDuration: 1.5,
        transcodedSegmentsDuration: 2.5,
        recordObjectStoreId: "mock_store",
      });
      res = await client.get(`/stream/${sess1.id}`);
      expect(res.status).toBe(200);
      sess1 = await res.json();
      expect(sess1.parentId).toEqual(parent.id);
      expect(sess1.name).toEqual("sess1");
      expect(sess1.transcodedSegments).toEqual(4);

      // get user sessions
      res = await client.get(`/stream/${parent.id}/sessions`);
      expect(res.status).toBe(200);
      let sessions = await res.json();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toEqual(sess1.id);
      expect(sessions[0].transcodedSegments).toEqual(4);
      expect(sessions[0].createdAt).toEqual(sess1.createdAt);

      // create second session
      res = await client.post(`/stream/${parent.id}/stream`, {
        ...smallStream,
        name: "sess2",
      });
      expect(res.status).toBe(201);
      let sess2 = await res.json();
      expect(sess2.record).toEqual(true);
      expect(sess2.parentId).toEqual(parent.id);
      expect(sess2.partialSession).toBeUndefined();
      expect(sess2.previousSessions).toBeUndefined();
      // add some usage and lastSeen
      now = Date.now();
      await server.db.stream.update(sess2.id, {
        lastSeen: now,
        sourceBytes: 5,
        transcodedBytes: 6,
        sourceSegments: 7,
        transcodedSegments: 8,
        sourceSegmentsDuration: 8.5,
        transcodedSegmentsDuration: 9.5,
        recordObjectStoreId: "mock_store",
      });
      res = await client.get(`/stream/${sess2.id}`);
      expect(res.status).toBe(200);
      sess2 = await res.json();
      expect(sess2.name).toEqual("sess2");
      expect(sess2.parentId).toEqual(parent.id);
      expect(sess2.transcodedSegments).toEqual(8);
      expect(sess2.partialSession).toBeUndefined();
      expect(sess2.previousSessions).toBeUndefined();
      expect(sess2.previousStats).toBeUndefined();
      // get raw second session
      res = await client.get(`/stream/${sess2.id}?raw=1`);
      expect(res.status).toBe(200);
      let sess2r = await res.json();
      expect(sess2r.record).toEqual(true);
      expect(sess2r.parentId).toEqual(parent.id);
      expect(sess2r.previousStats).toBeDefined();
      expect(sess2r.previousStats.sourceSegments).toEqual(3);
      await sleep(20);
      res = await client.get(`/stream/${sess1.id}?raw=1`);
      expect(res.status).toBe(200);
      let sess1r = await res.json();
      expect(sess1r.lastSessionId).toEqual(sess2r.id);
      expect(sess1r.partialSession).toEqual(true);

      res = await client.get(`/stream/${sess1.id}`);
      expect(res.status).toBe(200);
      let sess1n = await res.json();
      expect(sess1n.lastSessionId).toBeUndefined();
      expect(sess1n.createdAt).toEqual(sess1r.createdAt);
      expect(sess1n.lastSeen).toEqual(sess2r.lastSeen);
      expect(sess1n.previousStats).toBeUndefined();
      // sourceSegments should equal to sum of both sessions
      expect(sess1n.sourceSegments).toEqual(10);

      // get user sessions
      res = await client.get(`/stream/${parent.id}/sessions?forceUrl=1`);
      expect(res.status).toBe(200);
      sessions = await res.json();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toEqual(sess1r.id);
      expect(sessions[0].transcodedSegments).toEqual(12);
      expect(sessions[0].createdAt).toEqual(sess1r.createdAt);
      expect(sessions[0].recordingUrl).toEqual(`https://test/recordings/${sess2r.id}/index.m3u8`);
    });
  });
});

const smallStream = {
  id: "231e7a49-8351-400b-a3df-0bcde13754e4",
  name: "small01",
  record: true,
  profiles: [
    {
      fps: 0,
      name: "240p0",
      width: 426,
      height: 240,
      bitrate: 250000,
    },
  ],
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
