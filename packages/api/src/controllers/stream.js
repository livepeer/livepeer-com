import { parse as parseUrl } from "url";
import { authMiddleware } from "../middleware";
import { validatePost } from "../middleware";
import Router from "express/lib/router";
import logger from "../logger";
import uuid from "uuid/v4";
import wowzaHydrate from "./wowza-hydrate";
import { fetchWithTimeout } from "../util";
import fetch from "isomorphic-fetch";
import {
  makeNextHREF,
  trackAction,
  getWebhooks,
  parseFilters,
  parseOrder,
  pathJoin,
} from "./helpers";
import { terminateStream, listActiveStreams } from "./mist-api";
import { generateStreamKey } from "./generate-stream-key";
import { geolocateMiddleware } from "../middleware";
import { getBroadcasterHandler } from "./broadcaster";
import { db } from "../store";
import sql from "sql-template-strings";
import { BadRequestError, NotFoundError } from "../store/errors";

const WEBHOOK_TIMEOUT = 5 * 1000;
export const USER_SESSION_TIMEOUT = 5 * 60 * 1000; // 5 min
const ACTIVE_TIMEOUT = 90 * 1000;

const isLocalIP = require("is-local-ip");
const { Resolver } = require("dns").promises;

const app = Router();
const hackMistSettings = (req, profiles) => {
  if (
    !req.headers["user-agent"] ||
    !req.headers["user-agent"].toLowerCase().includes("mistserver")
  ) {
    return profiles;
  }
  profiles = profiles || [];
  return profiles.map((profile) => {
    profile = {
      ...profile,
    };
    if (typeof profile.gop === "undefined") {
      profile.gop = "2.0";
    }
    if (typeof profile.fps === "undefined") {
      profile.fps = 0;
    }
    return profile;
  });
};

async function validatePushTarget(userId, profileNames, pushTargetRef) {
  const { profile, id, spec } = pushTargetRef;
  if (!profileNames.has(profile) && profile !== "source") {
    throw new BadRequestError(
      `push target must reference existing profile. not found: "${profile}"`
    );
  }
  if (!!spec === !!id) {
    throw new BadRequestError(
      `push target must have either an "id" or a "spec"`
    );
  }
  if (id) {
    if (!(await db.pushTarget.hasAccess(id, userId))) {
      throw new BadRequestError(`push target not found: "${id}"`);
    }
    return pushTargetRef;
  }
  const created = await db.pushTarget.fillAndCreate({
    name: spec.name,
    url: spec.url,
    userId,
  });
  return { profile, id: created.id };
}

function validatePushTargets(userId, profiles, pushTargets) {
  const profileNames = new Set();
  for (const { name } of profiles) {
    if (!name) {
      continue;
    } else if (name === "source") {
      throw new BadRequestError(`profile cannot be named "source"`);
    }
    profileNames.add(name);
  }

  if (!pushTargets) {
    return Promise.resolve([]);
  }
  return Promise.all(
    pushTargets.map((p) => validatePushTarget(userId, profileNames, p))
  );
}

export function getRecordingUrl(ingest, session, mp4 = false) {
  return pathJoin(
    ingest,
    `recordings`,
    session.lastSessionId ? session.lastSessionId : session.id,
    mp4 ? `source.mp4` : `index.m3u8`
  );
}

function isActuallyNotActive(stream) {
  return (
    stream.isActive &&
    !isNaN(stream.lastSeen) &&
    Date.now() - stream.lastSeen > ACTIVE_TIMEOUT
  );
}

function activeCleanupOne(stream) {
  if (isActuallyNotActive(stream)) {
    db.stream.setActiveToFalse(stream);
    stream.isActive = false;
    return true;
  }
  return false;
}

function activeCleanup(streams, activeOnly = false) {
  let hasStreamsToClean;
  for (const stream of streams) {
    hasStreamsToClean = activeCleanupOne(stream);
  }
  if (activeOnly && hasStreamsToClean) {
    return streams.filter((s) => !isActuallyNotActive(s));
  }
  return streams;
}

const fieldsMap = {
  id: `stream.ID`,
  name: `stream.data->>'name'`,
  sourceSegments: `stream.data->'sourceSegments'`,
  lastSeen: { val: `stream.data->'lastSeen'`, type: "int" },
  createdAt: { val: `stream.data->'createdAt'`, type: "int" },
  userId: `stream.data->>'userId'`,
  isActive: { val: `stream.data->'isActive'`, type: "boolean" },
  "user.email": `users.data->>'email'`,
  parentId: `stream.data->>'parentId'`,
  record: { val: `stream.data->'record'`, type: "boolean" },
  suspended: { val: `stream.data->'suspended'`, type: "boolean" },
  sourceSegmentsDuration: {
    val: `stream.data->'sourceSegmentsDuration'`,
    type: "real",
  },
  transcodedSegments: { val: `stream.data->'transcodedSegments'`, type: "int" },
  transcodedSegmentsDuration: {
    val: `stream.data->'transcodedSegmentsDuration'`,
    type: "real",
  },
};

app.get("/", authMiddleware({}), async (req, res) => {
  let {
    limit,
    cursor,
    streamsonly,
    sessionsonly,
    all,
    active,
    nonLivepeerOnly,
    order,
    filters,
    userId,
  } = req.query;
  if (isNaN(parseInt(limit))) {
    limit = undefined;
  }

  if (!req.user.admin) {
    userId = req.user.id;
  }

  const query = parseFilters(fieldsMap, filters);
  if (!all || all === "false" || !req.user.admin) {
    query.push(sql`stream.data->>'deleted' IS NULL`);
  }
  if (req.user.admin) {
    if (nonLivepeerOnly && nonLivepeerOnly !== "false") {
      query.push(sql`users.data->>'email' NOT LIKE '%@livepeer.%'`);
    }
  }
  if (active && active !== "false") {
    query.push(sql`stream.data->>'isActive' = 'true'`);
  }
  if (streamsonly && streamsonly !== "false") {
    query.push(sql`stream.data->>'parentId' IS NULL`);
  } else if (sessionsonly && sessionsonly !== "false") {
    query.push(sql`stream.data->>'parentId' IS NOT NULL`);
  }
  if (userId) {
    query.push(sql`stream.data->>'userId' = ${userId}`);
  }

  if (!order) {
    order = "lastSeen-true,createdAt-true";
  }
  order = parseOrder(fieldsMap, order);

  const fields =
    " stream.id as id, stream.data as data, users.id as usersId, users.data as usersdata";
  const from = `stream left join users on stream.data->>'userId' = users.id`;
  const [output, newCursor] = await db.stream.find(query, {
    limit,
    cursor,
    fields,
    from,
    order,
    process: ({ data, usersdata }) => {
      return req.user.admin
        ? { ...data, user: db.user.cleanWriteOnlyResponse(usersdata) }
        : { ...data };
    },
  });

  res.status(200);

  if (newCursor) {
    res.links({ next: makeNextHREF(req, newCursor) });
  }
  res.json(
    activeCleanup(
      db.stream.addDefaultFieldsMany(
        db.stream.removePrivateFieldsMany(output, req.user.admin)
      ),
      !!active
    )
  );
});

function setRecordingStatus(req, ingest, session, forceUrl) {
  const olderThen = Date.now() - USER_SESSION_TIMEOUT;
  if (session.record && session.recordObjectStoreId && session.lastSeen > 0) {
    const isReady = session.lastSeen > 0 && session.lastSeen < olderThen;
    session.recordingStatus = isReady ? "ready" : "waiting";
    if (isReady || (req.user.admin && forceUrl)) {
      session.recordingUrl = getRecordingUrl(ingest, session);
      session.mp4Url = getRecordingUrl(ingest, session, true);
    }
  }
}

// returns only 'user' sessions and adds
app.get("/:parentId/sessions", authMiddleware({}), async (req, res) => {
  const { parentId } = req.params;
  const { record, forceUrl } = req.query;
  let { limit, cursor } = req.query;
  const raw = req.query.raw && req.user.admin;

  const ingests = await req.getIngest(req);
  if (!ingests.length) {
    res.status(501);
    return res.json({ errors: ["Ingest not configured"] });
  }
  const ingest = ingests[0].base;

  const stream = await db.stream.get(parentId);
  if (
    !stream ||
    (stream.deleted && !req.isUIAdmin) ||
    (stream.userId !== req.user.id && !req.isUIAdmin)
  ) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }

  let filterOut;
  const query = [];
  query.push(sql`data->>'parentId' = ${stream.id}`);
  query.push(sql`(data->'lastSeen')::bigint > 0`);
  query.push(sql`(data->'sourceSegmentsDuration')::bigint > 0`);
  query.push(sql`data->>'partialSession' IS NULL`);
  if (record) {
    if (record === "true" || record === "1") {
      query.push(sql`data->>'record' = 'true'`);
      query.push(sql`data->>'recordObjectStoreId' IS NOT NULL`);
    } else if (record === "false" || record === "0") {
      query.push(sql`data->>'recordObjectStoreId' IS NULL`);
      filterOut = true;
    }
  }

  let [sessions] = await db.stream.find(query, {
    order: `data->'lastSeen' DESC NULLS LAST`,
    limit,
    cursor,
  });

  const olderThen = Date.now() - USER_SESSION_TIMEOUT;
  sessions = sessions.map((session) => {
    setRecordingStatus(req, ingest, session, forceUrl);
    if (!raw) {
      if (session.previousSessions && session.previousSessions.length) {
        session.id = session.previousSessions[0]; // return id of the first session object so
        // user always see same id for the 'user' session
      }
      const combinedStats = getCombinedStats(
        session,
        session.previousStats || {}
      );
      return {
        ...session,
        ...combinedStats,
        createdAt: session.userSessionCreatedAt || session.createdAt,
      };
    }
    return session;
  });
  if (filterOut) {
    sessions = sessions.filter((sess) => !sess.record);
  }

  res.status(200);
  if (!raw) {
    db.stream.removePrivateFieldsMany(sessions, req.user.admin);
  }
  res.json(db.stream.addDefaultFieldsMany(sessions));
});

app.get("/sessions/:parentId", authMiddleware({}), async (req, res) => {
  const { parentId } = req.params;
  const { limit, cursor } = req.query;
  logger.info(`cursor params ${cursor}, limit ${limit}`);

  const stream = await db.stream.get(parentId);
  if (
    !stream ||
    stream.deleted ||
    (stream.userId !== req.user.id && !req.isUIAdmin)
  ) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }

  const { data: streams, cursor: cursorOut } = await req.store.queryObjects({
    kind: "stream",
    query: { parentId },
    cursor,
    limit,
  });
  res.status(200);
  if (streams.length > 0 && cursorOut) {
    res.links({ next: makeNextHREF(req, cursorOut) });
  }
  res.json(
    db.stream.addDefaultFieldsMany(
      db.stream.removePrivateFieldsMany(streams, req.user.admin)
    )
  );
});

app.get("/user/:userId", authMiddleware({}), async (req, res) => {
  const { userId } = req.params;
  let { limit, cursor, streamsonly, sessionsonly } = req.query;

  if (req.user.admin !== true && req.user.id !== req.params.userId) {
    res.status(403);
    return res.json({
      errors: ["user can only request information on their own streams"],
    });
  }

  const query = [
    sql`data->>'deleted' IS NULL`,
    sql`data->>'userId' = ${userId}`,
  ];
  if (streamsonly) {
    query.push(sql`data->>'parentId' IS NULL`);
  } else if (sessionsonly) {
    query.push(sql`data->>'parentId' IS NOT NULL`);
  }

  const [streams, newCursor] = await db.stream.find(query, {
    cursor,
    limit,
    order: `data->'lastSeen' DESC NULLS LAST, data->'createdAt' DESC NULLS LAST`,
  });

  res.status(200);

  if (newCursor) {
    res.links({ next: makeNextHREF(req, newCursor) });
  }
  res.json(
    activeCleanup(
      db.stream.addDefaultFieldsMany(
        db.stream.removePrivateFieldsMany(streams, req.user.admin)
      )
    )
  );
});

app.get("/:id", authMiddleware({}), async (req, res) => {
  const raw = req.query.raw && req.user.admin;
  let stream = await db.stream.get(req.params.id);
  if (
    !stream ||
    ((stream.userId !== req.user.id || stream.deleted) && !req.isUIAdmin)
  ) {
    // do not reveal that stream exists
    res.status(404);
    return res.json({ errors: ["not found"] });
  }
  activeCleanupOne(stream);
  // fixup 'user' session
  if (!raw && stream.lastSessionId) {
    const lastSession = await db.stream.get(stream.lastSessionId);
    if (!lastSession) {
      res.status(404);
      return res.json({ errors: ["not found"] });
    }
    lastSession.createdAt = stream.createdAt;
    // for 'user' session we're returning stats which
    // is a sum of all sessions
    const combinedStats = getCombinedStats(
      lastSession,
      lastSession.previousStats || {}
    );
    stream = {
      ...lastSession,
      ...combinedStats,
    };
  }
  if (stream.record) {
    const ingests = await req.getIngest(req);
    if (ingests.length) {
      const ingest = ingests[0].base;
      setRecordingStatus(req, ingest, stream, false);
    }
  }
  res.status(200);
  if (!raw) {
    db.stream.removePrivateFields(stream, req.user.admin);
  }
  res.json(db.stream.addDefaultFields(stream));
});

// returns stream by steamKey
app.get("/playback/:playbackId", authMiddleware({}), async (req, res) => {
  console.log(`headers:`, req.headers);
  const {
    data: [stream],
  } = await req.store.queryObjects({
    kind: "stream",
    query: { playbackId: req.params.playbackId },
  });
  if (
    !stream ||
    ((stream.userId !== req.user.id || stream.deleted) && !req.user.admin)
  ) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }
  res.status(200);
  res.json(
    db.stream.addDefaultFields(
      db.stream.removePrivateFields(stream, req.user.admin)
    )
  );
});

// returns stream by steamKey
app.get("/key/:streamKey", authMiddleware({}), async (req, res) => {
  const useReplica = req.query.main !== "true";
  const [docs] = await db.stream.find(
    { streamKey: req.params.streamKey },
    { useReplica }
  );
  if (
    !docs.length ||
    ((docs[0].userId !== req.user.id || docs[0].deleted) && !req.user.admin)
  ) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }
  res.status(200);
  res.json(
    db.stream.addDefaultFields(
      db.stream.removePrivateFields(docs[0], req.user.admin)
    )
  );
});

// Needed for Mist server
app.get(
  "/:streamId/broadcaster",
  geolocateMiddleware({}),
  getBroadcasterHandler
);

async function generateUniqueStreamKey(store, otherKeys) {
  while (true) {
    const streamKey = await generateStreamKey();
    const qres = await store.query({
      kind: "stream",
      query: { streamKey },
    });
    if (!qres.data.length && !otherKeys.includes(streamKey)) {
      return streamKey;
    }
  }
}

app.post(
  "/:streamId/stream",
  authMiddleware({}),
  validatePost("stream"),
  async (req, res) => {
    if (!req.body || !req.body.name) {
      res.status(422);
      return res.json({
        errors: ["missing name"],
      });
    }
    const start = Date.now();
    let stream;
    let useParentProfiles = false;
    if (req.config.baseStreamName === req.params.streamId) {
      if (!req.body.name.includes("+")) {
        res.status(422);
        return res.json({
          errors: ["wrong name"],
        });
      }
      const playbackId = req.body.name.split("+")[1];
      const [docs] = await db.stream.find(
        { playbackId },
        { useReplica: false }
      );
      if (docs.length) {
        stream = docs[0];
        useParentProfiles = true;
      }
    } else {
      stream = await db.stream.get(req.params.streamId);
    }

    if (
      !stream ||
      ((stream.userId !== req.user.id || stream.deleted) &&
        !(req.user.admin && !stream.deleted))
    ) {
      // do not reveal that stream exists
      res.status(404);
      return res.json({ errors: ["not found"] });
    }

    // The first four letters of our playback id are the shard key.
    const id = stream.playbackId.slice(0, 4) + uuid().slice(4);
    const createdAt = Date.now();

    let previousSessions, previousStats, userSessionCreatedAt;
    let firstSession = true;
    if (stream.record && req.config.recordObjectStoreId) {
      // find previous sessions to form 'user' session
      const tooOld = createdAt - USER_SESSION_TIMEOUT;
      const query = [];
      query.push(sql`data->>'parentId' = ${stream.id}`);
      query.push(
        sql`((data->'lastSeen')::bigint > ${tooOld} OR  (data->'createdAt')::bigint > ${tooOld})`
      );

      const [prevSessionsDocs] = await db.stream.find(query, {
        order: `data->'lastSeen' DESC, data->'createdAt' DESC `,
      });
      if (
        prevSessionsDocs.length &&
        prevSessionsDocs[0].recordObjectStoreId ==
          req.config.recordObjectStoreId
      ) {
        const latestSession = prevSessionsDocs[0];
        userSessionCreatedAt =
          latestSession.userSessionCreatedAt || latestSession.createdAt;
        previousSessions = latestSession.previousSessions;
        if (!Array.isArray(previousSessions)) {
          previousSessions = [];
        }
        previousSessions.push(latestSession.id);
        previousStats = getCombinedStats(
          latestSession,
          latestSession.previousStats || {}
        );
        firstSession = false;
        setImmediate(() => {
          db.session
            .update(previousSessions[0], {
              lastSessionId: id,
            })
            .catch((e) => {
              logger.error(e);
            });
        });
        setImmediate(() => {
          db.stream
            .update(previousSessions[0], {
              lastSessionId: id,
            })
            .catch((e) => {
              logger.error(e);
            });
        });
        setImmediate(() => {
          db.stream
            .update(latestSession.id, {
              partialSession: true,
            })
            .catch((e) => {
              logger.error(e);
            });
        });
      }
    }

    let region;
    if (req.config.ownRegion) {
      region = req.config.ownRegion;
    }

    const doc = wowzaHydrate({
      ...req.body,
      kind: "stream",
      userId: stream.userId,
      renditions: {},
      objectStoreId: stream.objectStoreId,
      recordObjectStoreId: stream.recordObjectStoreId,
      record: stream.record,
      id,
      createdAt,
      parentId: stream.id,
      previousSessions,
      previousStats,
      userSessionCreatedAt,
      region,
      lastSeen: 0,
      isActive: false,
    });

    doc.profiles = hackMistSettings(
      req,
      useParentProfiles ? stream.profiles : doc.profiles
    );

    if (firstSession) {
      // create 'session' object in 'session table
      const session = {
        id,
        parentId: stream.id,
        playbackId: stream.playbackId,
        userId: stream.userId,
        kind: "session",
        name: req.body.name,
        createdAt,
        lastSeen: 0,
        sourceSegments: 0,
        transcodedSegments: 0,
        sourceSegmentsDuration: 0,
        transcodedSegmentsDuration: 0,
        sourceBytes: 0,
        transcodedBytes: 0,
        ingestRate: 0,
        outgoingRate: 0,
        deleted: false,
        recordObjectStoreId: stream.recordObjectStoreId,
        record: stream.record,
        profiles: doc.profiles,
      };
      if (session.record) {
        session.recordingStatus = "waiting";
        session.recordingUrl = "";
        session.mp4Url = "";
      }
      await db.session.create(session);
    }

    try {
      await req.store.create(doc);
      setImmediate(async () => {
        // execute in parallel to not slowdown stream creation
        try {
          let email = req.user.email;
          const user = await db.user.get(stream.userId);
          if (user) {
            email = user.email;
          }
          await trackAction(
            stream.userId,
            email,
            { name: "Stream Session Created" },
            req.config.segmentApiKey
          );
        } catch (e) {
          console.error(`error tracking session err=`, e);
        }
      });
    } catch (e) {
      console.error(e);
      throw e;
    }
    res.status(201);
    res.json(db.stream.removePrivateFields(doc, req.user.admin));
    logger.info(
      `stream session created for stream_id=${stream.id} stream_name='${
        stream.name
      }' playbackid=${stream.playbackId} session_id=${id} elapsed=${
        Date.now() - start
      }ms`
    );
  }
);

app.post("/", authMiddleware({}), validatePost("stream"), async (req, res) => {
  if (!req.body || !req.body.name) {
    res.status(422);
    return res.json({
      errors: ["missing name"],
    });
  }
  const id = uuid();
  const createdAt = Date.now();
  let streamKey = await generateUniqueStreamKey(req.store, []);
  // Mist doesn't allow dashes in the URLs
  let playbackId = (
    await generateUniqueStreamKey(req.store, [streamKey])
  ).replace(/-/g, "");

  // use the first four characters of the id as the "shard key" across all identifiers
  const shardKey = id.slice(0, 4);
  streamKey = shardKey + streamKey.slice(4);
  playbackId = shardKey + playbackId.slice(4);

  let objectStoreId;
  if (req.body.objectStoreId) {
    const store = await db.objectStore.get(req.body.objectStoreId);
    if (!store) {
      res.status(400);
      return res.json({
        errors: [`object-store ${req.body.objectStoreId} does not exist`],
      });
    }
  }

  const doc = wowzaHydrate({
    ...req.body,
    kind: "stream",
    userId: req.user.id,
    renditions: {},
    objectStoreId,
    id,
    createdAt,
    streamKey,
    playbackId,
    createdByTokenName: req.tokenName,
    createdByTokenId: req.tokenId,
    isActive: false,
    lastSeen: 0,
  });

  doc.profiles = hackMistSettings(req, doc.profiles);
  doc.pushTargets = await validatePushTargets(
    req.user.id,
    doc.profiles,
    doc.pushTargets
  );

  await Promise.all([
    req.store.create(doc),
    trackAction(
      req.user.id,
      req.user.email,
      { name: "Stream Created" },
      req.config.segmentApiKey
    ),
  ]);

  res.status(201);
  res.json(
    db.stream.addDefaultFields(
      db.stream.removePrivateFields(doc, req.user.admin)
    )
  );
});

app.put("/:id/setactive", authMiddleware({}), async (req, res) => {
  const { id } = req.params;
  // logger.info(`got /setactive/${id}: ${JSON.stringify(req.body)}`)
  const useReplica = !req.body.active;
  const stream = await db.stream.get(id, { useReplica });
  if (!stream || (stream.deleted && !req.user.admin)) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }

  if (stream.suspended) {
    res.status(403);
    return res.json({ errors: ["stream is suspended"] });
  }

  const user = await db.user.get(stream.userId);
  if (!user) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }

  if (user.suspended) {
    res.status(403);
    return res.json({ errors: ["user is suspended"] });
  }

  if (req.body.active) {
    // trigger the webhooks, reference https://github.com/livepeer/livepeerjs/issues/791#issuecomment-658424388
    // this could be used instead of /webhook/:id/trigger (althoughs /trigger requires admin access )

    // -------------------------------
    // new webhookCannon
    req.queue.emit({
      id: uuid(),
      createdAt: Date.now(),
      channel: "webhooks",
      event: "stream.started",
      streamId: id,
      userId: user.id,
    });
    res.status(204);
    return res.end();
    // Everything under this should be removed since we moved
    // away from blocking webhooks
    // -------------------------------

    // basic sanitization.
    let sanitized = { ...stream };
    delete sanitized.streamKey;

    const { data: webhooksList } = await getWebhooks(
      req.store,
      stream.userId,
      "stream.started"
    );
    try {
      const responses = await Promise.all(
        webhooksList.map(async (webhook, key) => {
          // console.log('webhook: ', webhook)
          console.log(`trying webhook ${webhook.name}: ${webhook.url}`);
          let ips, urlObj, isLocal;
          try {
            urlObj = parseUrl(webhook.url);
            if (urlObj.host) {
              const resolver = new Resolver();
              ips = await resolver.resolve4(urlObj.hostname);
            }
          } catch (e) {
            console.error("error: ", e);
            throw e;
          }

          // This is mainly useful for local testing
          if (req.user.admin) {
            isLocal = false;
          } else {
            try {
              if (ips && ips.length) {
                isLocal = isLocalIP(ips[0]);
              } else {
                isLocal = true;
              }
            } catch (e) {
              console.error("isLocal Error", isLocal, e);
              throw e;
            }
          }
          if (isLocal) {
            // don't fire this webhook.
            console.log(
              `webhook ${webhook.id} resolved to a localIP, url: ${webhook.url}, resolved IP: ${ips}`
            );
          } else {
            console.log("preparing to fire webhook ", webhook.url);
            // go ahead
            let params = {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "user-agent": "livepeer.com",
              },
              timeout: WEBHOOK_TIMEOUT,
              body: JSON.stringify({
                id: webhook.id,
                event: webhook.event,
                stream: sanitized,
              }),
            };

            try {
              logger.info(`webhook ${webhook.id} firing`);
              let resp = await fetchWithTimeout(webhook.url, params);
              if (resp.status >= 200 && resp.status < 300) {
                // 2xx requests are cool.
                // all is good
                logger.info(`webhook ${webhook.id} fired successfully`);
                return true;
              }
              console.error(
                `webhook ${webhook.id} didn't get 200 back! response status: ${resp.status}`
              );
              return !webhook.blocking;
            } catch (e) {
              console.log("firing error", e);
              return !webhook.blocking;
            }
          }
        })
      );
      if (responses.some((o) => !o)) {
        // at least one of responses is false, blocking this stream
        res.status(403);
        return res.end();
      }
    } catch (e) {
      console.error("webhook loop error", e);
      res.status(400);
      return res.end();
    }
  }

  stream.isActive = !!req.body.active;
  stream.lastSeen = +new Date();
  const { ownRegion: region } = req.config;
  const { hostName: mistHost } = req.body;
  await db.stream.update(stream.id, {
    isActive: stream.isActive,
    lastSeen: stream.lastSeen,
    mistHost,
    region,
  });

  db.user.update(stream.userId, {
    lastStreamedAt: Date.now(),
  });

  if (stream.parentId) {
    const pStream = await db.stream.get(stream.parentId);
    if (pStream && !pStream.deleted) {
      await db.stream.update(pStream.id, {
        isActive: stream.isActive,
        lastSeen: stream.lastSeen,
        region,
      });
    }
  }

  res.status(204);
  res.end();
});

app.patch(
  "/:id",
  authMiddleware({}),
  validatePost("stream-patch-payload"),
  async (req, res) => {
    const { id } = req.params;
    const stream = await db.stream.get(id);

    const exists = stream && !stream.deleted;
    const hasAccess = stream?.userId === req.user.id || req.isUIAdmin;
    if (!exists || !hasAccess) {
      res.status(404);
      return res.json({ errors: ["not found"] });
    }
    if (stream.parentId) {
      res.status(400);
      return res.json({ errors: ["can't patch stream session"] });
    }

    let { record, suspended, pushTargets } = req.body;
    let patch = {};
    if (typeof record === "boolean") {
      patch = { ...patch, record };
    }
    if (typeof suspended === "boolean") {
      patch = { ...patch, suspended };
    }
    if (pushTargets) {
      pushTargets = await validatePushTargets(
        req.user.id,
        stream.profiles,
        pushTargets
      );
      patch = { ...patch, pushTargets };
    }
    if (Object.keys(patch).length === 0) {
      return res.status(204).end();
    }

    await db.stream.update(stream.id, patch);
    if (patch.suspended) {
      // kill live stream
      await terminateStreamReq(req, stream);
    }

    res.status(204);
    res.end();
  }
);

app.patch("/:id/record", authMiddleware({}), async (req, res) => {
  const { id } = req.params;
  const stream = await db.stream.get(id);
  if (!stream || stream.deleted) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }
  if (stream.parentId) {
    res.status(400);
    return res.json({ errors: ["can't set for session"] });
  }
  if (req.body.record === undefined) {
    res.status(400);
    return res.json({ errors: ["record field required"] });
  }
  console.log(`set stream ${id} record ${req.body.record}`);

  await db.stream.update(stream.id, { record: !!req.body.record });

  res.status(204);
  res.end();
});

app.delete("/:id", authMiddleware({}), async (req, res) => {
  const { id } = req.params;
  const stream = await db.stream.get(id);
  if (
    !stream ||
    stream.deleted ||
    (stream.userId !== req.user.id && !req.isUIAdmin)
  ) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }

  await db.stream.update(stream.id, {
    deleted: true,
  });
  // now kill live stream
  await terminateStreamReq(req, stream);
  res.status(204);
  res.end();
});

app.delete("/", authMiddleware({}), async (req, res) => {
  if (!req.body || !req.body.ids || !req.body.ids.length) {
    res.status(422);
    return res.json({
      errors: ["missing ids"],
    });
  }
  const ids = req.body.ids;

  if (!req.user.admin) {
    const streams = await db.stream.getMany(ids);
    if (
      streams.length !== ids.length ||
      streams.some((s) => s.userId !== req.user.id)
    ) {
      res.status(404);
      return res.json({ errors: ["not found"] });
    }
  }
  await db.stream.markDeletedMany(ids);

  res.status(204);
  res.end();
});

app.get("/:id/info", authMiddleware({}), async (req, res) => {
  let { id } = req.params;
  let stream = await db.stream.getByStreamKey(id);
  let session,
    isPlaybackid = false,
    isStreamKey = !!stream,
    isSession = false;
  if (!stream) {
    stream = await db.stream.getByPlaybackId(id);
    isPlaybackid = !!stream;
  }
  if (!stream) {
    stream = await db.stream.get(id);
  }
  if (stream && stream.parentId) {
    session = stream;
    isSession = true;
    stream = await db.stream.get(stream.parentId);
  }
  if (
    !stream ||
    (!req.user.admin && (stream.deleted || stream.userId !== req.user.id))
  ) {
    res.status(404);
    return res.json({
      errors: ["not found"],
    });
  }
  activeCleanupOne(stream);
  if (!session) {
    // find last session
    session = await db.stream.getLastSession(stream.id);
    if (session) {
      session = db.stream.addDefaultFields(session);
    }
  }
  const user = await db.user.get(stream.userId);
  const resp = {
    stream: db.stream.addDefaultFields(
      db.stream.removePrivateFields(stream, req.user.admin)
    ),
    session,
    isPlaybackid,
    isSession,
    isStreamKey,
    user: req.user.admin ? user : undefined,
  };

  res.status(200);
  res.json(resp);
});

app.patch("/:id/suspended", authMiddleware({}), async (req, res) => {
  const { id } = req.params;
  if (
    !req.body ||
    !Object.prototype.hasOwnProperty.call(req.body, "suspended") ||
    typeof req.body.suspended !== "boolean"
  ) {
    res.status(422);
    return res.json({
      errors: ["missing suspended property"],
    });
  }
  const { suspended } = req.body;
  const stream = await db.stream.get(id);
  if (
    !stream ||
    (!req.user.admin && (stream.deleted || stream.userId !== req.user.id))
  ) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }
  await db.stream.update(stream.id, { suspended });
  if (suspended) {
    // now kill live stream
    await terminateStreamReq(req, stream);
  }
  res.status(204);
  res.end();
});

app.delete("/:id/terminate", authMiddleware({}), async (req, res) => {
  const { id } = req.params;
  const stream = await db.stream.get(id);
  if (
    !stream ||
    (!req.user.admin && (stream.deleted || stream.userId !== req.user.id))
  ) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }
  const { status, result, errors } = await terminateStreamReq(req, stream);
  res.status(status);
  return res.json({ result, errors });
});

async function terminateStreamReq(req, stream) {
  if (!stream.isActive) {
    return { status: 410, errors: ["not active"] };
  }
  if (!stream.region) {
    return { status: 400, errors: ["region not found"] };
  }
  if (!stream.mistHost) {
    return { status: 400, errors: ["Mist host not found"] };
  }

  const mistHost = stream.mistHost;
  const { ownRegion, mistUsername, mistPassword, mistPort } = req.config;
  if (!ownRegion || !mistPassword || !mistUsername) {
    return { status: 500, errors: ["server not properly configured"] };
  }
  if (stream.region != ownRegion) {
    // redirect request to other region
    const protocol =
      req.headers["x-forwarded-proto"] === "https" ? "https" : "http";

    const regionalUrl = `${protocol}://${stream.region}.${req.frontendDomain}/api/stream/${stream.id}/terminate`;
    const redRes = await fetch(regionalUrl, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: req.headers.authorization,
      },
    });
    const body = await redRes.json();
    const { result, errors } = body;
    return { status: redRes.status, result, errors };
  }
  const streams = await listActiveStreams(
    mistHost,
    mistPort,
    mistUsername,
    mistPassword
  );
  const mistStreamName = streams.find((sn) => sn.endsWith(stream.playbackId));
  if (!mistStreamName) {
    return { status: 200, result: false, errors: ["not found on Mist"] };
  }

  const nukeRes = await terminateStream(
    mistHost,
    mistPort,
    mistStreamName,
    mistUsername,
    mistPassword
  );
  return { status: 200, result: nukeRes };
}

// Hooks

const streamDetectionEvent = "stream.detection";

app.post("/hook", async (req, res) => {
  if (!req.body || !req.body.url) {
    res.status(422);
    return res.json({
      errors: ["missing url"],
    });
  }
  // logger.info(`got webhook: ${JSON.stringify(req.body)}`)
  // These are of the form /live/:manifestId/:segmentNum.ts
  let { pathname, protocol } = parseUrl(req.body.url);
  // Protocol is sometimes undefined, due to https://github.com/livepeer/go-livepeer/issues/1006
  if (!protocol) {
    protocol = "http:";
  }
  if (protocol === "https:") {
    protocol = "http:";
  }
  if (protocol !== "http:" && protocol !== "rtmp:") {
    res.status(422);
    return res.json({ errors: [`unknown protocol: ${protocol}`] });
  }

  // Allowed patterns, for now:
  // http(s)://broadcaster.example.com/live/:streamId/:segNum.ts
  // rtmp://broadcaster.example.com/live/:streamId
  const [live, streamId, ...rest] = pathname.split("/").filter((x) => !!x);
  // logger.info(`live=${live} streamId=${streamId} rest=${rest}`)

  if (!streamId) {
    res.status(401);
    return res.json({ errors: ["stream key is required"] });
  }
  if (protocol === "rtmp:" && rest.length > 0) {
    res.status(422);
    return res.json({
      errors: [
        "RTMP address should be rtmp://example.com/live. Stream key should be a UUID.",
      ],
    });
  }
  if (protocol === "http:" && rest.length > 3) {
    res.status(422);
    return res.json({
      errors: [
        "acceptable URL format: http://example.com/live/:streamId/:number.ts",
      ],
    });
  }

  if (live !== "live" && live !== "recordings") {
    res.status(404);
    return res.json({ errors: ["ingest url must start with /live/"] });
  }

  let stream = await db.stream.get(streamId);
  if (!stream) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }

  if (stream.suspended) {
    res.status(403);
    return res.json({ errors: ["stream is suspended"] });
  }

  const user = await db.user.get(stream.userId);
  if (!user) {
    res.status(404);
    return res.json({ errors: ["not found"] });
  }

  if (user.suspended) {
    res.status(403);
    return res.json({ errors: ["user is suspended"] });
  }

  let objectStore,
    recordObjectStore = undefined,
    recordObjectStoreUrl;
  if (stream.objectStoreId) {
    const os = await db.objectStore.get(stream.objectStoreId);
    if (!os) {
      res.status(500);
      return res.json({
        errors: [
          `data integity error: object store ${stream.objectStoreId} not found`,
        ],
      });
    }
    objectStore = os.url;
  }
  const isLive = live === "live";
  if (
    isLive &&
    stream.record &&
    req.config.recordObjectStoreId &&
    !stream.recordObjectStoreId
  ) {
    const ros = await db.objectStore.get(req.config.recordObjectStoreId);
    if (ros && !ros.disabled) {
      await db.stream.update(stream.id, {
        recordObjectStoreId: req.config.recordObjectStoreId,
      });
      stream.recordObjectStoreId = req.config.recordObjectStoreId;
      if (stream.parentId && !stream.previousSessions) {
        await db.session.update(stream.id, {
          recordObjectStoreId: req.config.recordObjectStoreId,
        });
      }
    }
  }
  if (stream.recordObjectStoreId && !req.config.supressRecordInHook) {
    const ros = await db.objectStore.get(stream.recordObjectStoreId);
    if (!ros) {
      res.status(500);
      return res.json({
        errors: [
          `data integity error: record object store ${stream.recordObjectStoreId} not found`,
        ],
      });
    }
    recordObjectStore = ros.url;
    if (ros.publicUrl) {
      recordObjectStoreUrl = ros.publicUrl;
    }
  }

  // Use our parents' playbackId for sharded playback
  let manifestID = streamId;
  if (stream.parentId) {
    const parent = await db.stream.get(stream.parentId);
    manifestID = parent.playbackId;
  }

  const { data: webhooks } = await db.webhook.listSubscribed(
    user.id,
    streamDetectionEvent
  );
  let detection = undefined;
  if (webhooks.length > 0 || stream.detection) {
    // TODO: Validate if these are the best default configs
    detection = {
      freq: 4, // Segment sample rate. Process 1 / freq segments
      sampleRate: 10, // Frames sample rate. Process 1 / sampleRate frames of a segment
      sceneClassification: [{ name: "soccer" }, { name: "adult" }],
    };
    if (stream.detection?.sceneClassification) {
      detection.sceneClassification = stream.detection?.sceneClassification;
    }
    console.log(`DetectionHookResponse: ${JSON.stringify(detection)}`);
  }

  res.json({
    manifestID,
    presets: stream.presets,
    profiles: stream.profiles,
    objectStore,
    recordObjectStore,
    recordObjectStoreUrl,
    previousSessions: stream.previousSessions,
    detection,
  });
});

// TODO: create some tests for this
app.post(
  "/hook/detection",
  validatePost("detection-webhook-payload"),
  async (req, res) => {
    const { manifestID, seqNo, sceneClassification } = req.body;
    const stream = await db.stream.getByPlaybackId(manifestID);
    if (!stream) {
      return res.status(404).json({ errors: ["stream not found"] });
    }
    console.log(`DetectionWebhookPayload: ${JSON.stringify(req.body)}`);

    await req.queue.emit({
      id: uuid(),
      createdAt: Date.now(),
      channel: "webhooks",
      event: streamDetectionEvent,
      streamId: stream.id,
      userId: stream.userId,
      payload: {
        seqNo,
        sceneClassification,
      },
    });
    return res.status(204);
  }
);

const statsFields = [
  "sourceBytes",
  "transcodedBytes",
  "sourceSegments",
  "transcodedSegments",
  "sourceSegmentsDuration",
  "transcodedSegmentsDuration",
];

export function getCombinedStats(stream1, stream2) {
  const res = {};
  for (const fn of statsFields) {
    res[fn] = (stream1[fn] || 0) + (stream2[fn] || 0);
  }
  return res;
}

export default app;
