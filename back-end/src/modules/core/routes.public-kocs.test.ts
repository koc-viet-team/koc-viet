import assert from 'node:assert/strict'
import test from 'node:test'
import { route } from './routes.js'

// Bắt câu SQL đếm và câu SQL lấy danh sách của trang Khám phá KOC công khai (/api/kocs).
async function publicKocQueries(params: string) {
  const calls: Array<{sql: string; values: unknown[]}> = []
  const database = {
    prepare(sql: string) {
      const call = {sql, values: [] as unknown[]}
      calls.push(call)
      const statement = {
        bind(...values: unknown[]) { call.values = values; return statement },
        async first(column?: string) {
          if (sql.includes('COUNT(*)')) return column ? 0 : {c:0}
          return null
        },
        async all() { return {results:[]} },
      }
      return statement
    },
  }
  const request = new Request('http://localhost/api/kocs?'+params)
  const response = await route(request,{DB:database,JWT_SECRET:'public-kocs-test-secret-at-least-32-bytes'} as never,new URL(request.url))
  assert.equal(response.status,200)
  return calls.filter(call=>/FROM kocs\b/.test(call.sql))
}

test('KOC name search ignores case and Vietnamese accents', async () => {
  const calls = await publicKocQueries('search=MAI%20Ng%E1%BB%8Dc')
  assert.equal(calls.length,2)
  for (const {sql,values} of calls) {
    assert.match(sql,/translate\(lower\(concat_ws\(' ', name\)\)/)
    assert.doesNotMatch(sql,/\bname LIKE \?/)
    assert.ok(values.includes('%mai%'))
    assert.ok(values.includes('%ngoc%'))
  }
})

test('KOC max price filters in SQL so total and pages match', async () => {
  const calls = await publicKocQueries('maxPrice=5000000')
  assert.equal(calls.length,2)
  for (const {sql,values} of calls) {
    assert.match(sql,/EXISTS \(SELECT 1 FROM koc_prices kp WHERE kp\.koc_id=kocs\.id AND kp\.price<=\?\)/)
    assert.ok(values.includes(5000000))
  }
})

test('KOC max price ignores empty, zero and invalid values', async () => {
  for (const value of ['', '0', '-5', 'abc']) {
    const calls = await publicKocQueries('maxPrice='+value)
    for (const {sql} of calls) assert.doesNotMatch(sql,/koc_prices kp/)
  }
})
