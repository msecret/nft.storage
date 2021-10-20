import { validate } from '../utils/auth-v1.js'
import { JSONResponse } from '../utils/json-response.js'

/** @type {import('../bindings').Handler} */
export const tokensDeleteV1 = async (event, ctx) => {
  await validate(event, ctx)
  const body = await event.request.json()

  if (body.id) {
    await ctx.db.deleteKey(body.id)
  } else {
    throw new Error('Token id is required.')
  }

  return new JSONResponse({
    ok: true,
  })
}
