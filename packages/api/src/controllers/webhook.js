import { parse as parseUrl } from 'url'
import { authMiddleware } from '../middleware'
import { validatePost } from '../middleware'
import Router from 'express/lib/router'
import logger from '../logger'
import uuid from 'uuid/v4'
import { makeNextHREF, trackAction, getWebhooks } from './helpers'
import { db } from '../store'
import sql from 'sql-template-strings'

const app = Router()

app.get('/', authMiddleware({}), async (req, res) => {
  let { limit, cursor, all, event, allUsers } = req.query

  if (req.user.admin && allUsers) {
    const query = []
    if (!all) {
      query.push(sql`data->>'deleted' IS NULL`)
    }
    const [output, newCursor] = await db.webhook.find(query, { cursor })
    res.status(200)

    if (output.length > 0) {
      res.links({ next: makeNextHREF(req, newCursor) })
    }
    return res.json(output)
  }

  let output = await getWebhooks(
    req.store,
    req.user.id,
    event,
    limit,
    cursor,
    all,
  )
  res.status(200)

  if (output.data.length > 0) {
    res.links({ next: makeNextHREF(req, output.cursor) })
  }
  res.json(output.data)
})

app.post('/', authMiddleware({}), validatePost('webhook'), async (req, res) => {
  const id = uuid()
  const createdAt = Date.now()

  let urlObj
  try {
    urlObj = parseUrl(req.body.url)
  } catch (e) {
    console.error(`couldn't parse the url provided ${req.body.url}`)
    res.status(400)
    return res.end()
  }

  if (
    !urlObj.protocol ||
    (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:')
  ) {
    res.status(406)
    return res.json({ errors: ['url provided should be http or https only'] })
  }

  const doc = {
    id,
    userId: req.user.id,
    kind: 'webhook',
    name: req.body.name,
    createdAt: createdAt,
    event: req.body.event,
    url: req.body.url,
    blocking: req.body.blocking === undefined ? true : !!req.body.blocking,
  }

  try {
    await req.store.create(doc)
    trackAction(
      req.user.id,
      req.user.email,
      { name: 'Webhook Created' },
      req.config.segmentApiKey,
    )
  } catch (e) {
    console.error(e)
    throw e
  }
  res.status(201)
  res.json(doc)
})

app.get('/:id', authMiddleware({}), async (req, res) => {
  // get a specific webhook
  logger.info(`webhook params ${req.params.id}`)

  const webhook = await req.store.get(`webhook/${req.params.id}`)
  if (
    !webhook ||
    ((webhook.deleted || webhook.userId !== req.user.id) && !req.user.admin)
  ) {
    res.status(404)
    return res.json({ errors: ['not found'] })
  }

  res.status(200)
  res.json(webhook)
})

app.put(
  '/:id',
  authMiddleware({}),
  validatePost('webhook'),
  async (req, res) => {
    // modify a specific webhook
    const webhook = await req.store.get(`webhook/${req.body.id}`)
    if (
      (webhook.userId !== req.user.id || webhook.deleted) &&
      !req.user.admin
    ) {
      // do not reveal that webhooks exists
      res.status(404)
      return res.json({ errors: ['not found'] })
    }

    let urlObj
    try {
      urlObj = parseUrl(req.body.url)
    } catch (e) {
      console.error(`couldn't parse the url provided ${req.body.url}`)
      res.status(400)
      return res.end()
    }

    if (
      !urlObj.protocol ||
      (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:')
    ) {
      res.status(406)
      return res.json({ errors: ['url provided should be http or https only'] })
    }

    try {
      await req.store.replace(req.body)
    } catch (e) {
      console.error(e)
      throw e
    }
    res.status(200)
    res.json({ id: req.body.id })
  },
)

app.delete('/:id', authMiddleware({}), async (req, res) => {
  // delete a specific webhook
  const webhook = await req.store.get(`webhook/${req.params.id}`)

  if (
    !webhook ||
    ((webhook.deleted || webhook.userId !== req.user.id) && !req.isUIAdmin)
  ) {
    // do not reveal that webhooks exists
    res.status(404)
    return res.json({ errors: ['not found'] })
  }

  webhook.deleted = true
  try {
    await req.store.replace(webhook)
  } catch (e) {
    console.error(e)
    throw e
  }
  res.status(204)
  res.end()
})

export default app
