import { validate } from '../utils/auth-v1.js'
import { setIn } from '../utils/utils.js'
import { JSONResponse } from '../utils/json-response.js'
import * as CBOR from '@ipld/dag-cbor'
import * as cluster from '../cluster.js'
import { CID } from 'multiformats'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Block from 'multiformats/block'
import * as CAR from '../utils/car.js'
import { debug } from '../utils/debug.js'
import * as constants from '../constants.js'
import { uploadCar } from './nfts-upload.js'

const log = debug('nft-store')

/**
 * @typedef {import('../bindings').NFT} NFT
 */

/** @type {import('../bindings').Handler} */
export async function nftStoreV1(event, ctx) {
  const { user, key } = await validate(event, ctx)
  const form = await event.request.formData()

  const meta = /** @type {string} */ (form.get('meta'))
  const data = JSON.parse(meta)
  const dag = JSON.parse(meta)

  const files = []

  for (const [name, content] of form.entries()) {
    if (name !== 'meta') {
      const file = /** @type {File} */ (content)
      const asset = await cluster.importAsset(file, {
        local: file.size > constants.cluster.localAddThreshold,
      })
      const cid = CID.parse(asset)

      const href = `ipfs://${cid}/${file.name}`
      const path = name.split('.')
      setIn(data, path, href)
      setIn(dag, path, cid)
      files.push({ name: file.name, type: file.type })
    }
  }

  const blob = new Blob([JSON.stringify(data)])
  const metadata = await cluster.add(blob, {
    local: blob.size > constants.cluster.localAddThreshold,
  })
  const block = await Block.encode({
    value: {
      ...dag,
      'metadata.json': CID.parse(metadata.cid),
      type: 'nft',
    },
    codec: CBOR,
    hasher: sha256,
  })
  const car = await CAR.encode([block.cid], [block])

  // TODO: how to do this?
  const upload = await uploadCar({
    ctx,
    user,
    key,
    car,
    uploadType: 'Nft',
    mimeType: 'application/ipnft',
    isComplete: false, // TODO: needs to be complete
    files
  })

  const result = {
    ok: true,
    value: {
      ipnft: upload.content_cid,
      url: `ipfs://${upload.content_cid}/metadata.json`,
      data,
    },
  }

  return new JSONResponse(result)
}
