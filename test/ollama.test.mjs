import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { buildPayload, parseOllamaResponse, dispatch } from '../lib/ollama.mjs'

test('buildPayload sets model, message, stream false, num_predict', () => {
  const p = JSON.parse(buildPayload('glm-5.1:cloud', 'hi', 1000))
  assert.equal(p.model, 'glm-5.1:cloud')
  assert.equal(p.stream, false)
  assert.equal(p.messages[0].content, 'hi')
  assert.equal(p.options.num_predict, 1000)
})

test('parseOllamaResponse reads content, falls back to thinking, throws on error', () => {
  assert.equal(parseOllamaResponse(JSON.stringify({ message: { content: 'x' } })).content, 'x')
  assert.equal(parseOllamaResponse(JSON.stringify({ message: { content: '', thinking: 't' } })).content, 't')
  assert.throws(() => parseOllamaResponse(JSON.stringify({ error: 'boom' })), /boom/)
})

test('dispatch hits a stub server and returns content', async () => {
  const server = http.createServer((req, res) => res.end(JSON.stringify({ message: { content: 'ok' }, model: 'stub' })))
  await new Promise(r => server.listen(0, r))
  const port = server.address().port
  const r = await dispatch('stub', 'prompt', `http://localhost:${port}`, 0)
  server.close()
  assert.equal(r.success, true)
  assert.equal(r.content, 'ok')
})
