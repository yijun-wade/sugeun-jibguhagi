// 로컬 개발용 API 서버 (vercel serverless 함수를 Express처럼 실행)
import { createServer } from 'http'
import { parse } from 'url'

// API 핸들러 동적 임포트
const handlers = {}

async function loadHandlers() {
  const [search, trade, geocode, stories, vibe] = await Promise.all([
    import('./api/search.js'),
    import('./api/trade.js'),
    import('./api/geocode.js'),
    import('./api/stories.js'),
    import('./api/vibe.js'),
  ])
  handlers['/api/search']  = search.default
  handlers['/api/trade']   = trade.default
  handlers['/api/geocode'] = geocode.default
  handlers['/api/stories'] = stories.default
  handlers['/api/vibe']    = vibe.default
}

// Vercel req/res 형태를 Node http로 래핑
function wrapReq(req, parsedUrl) {
  req.query = Object.fromEntries(new URLSearchParams(parsedUrl.query || ''))
  return req
}

function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res }
  res.json   = (data) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify(data))
  }
  return res
}

await loadHandlers()

const server = createServer(async (req, res) => {
  const parsed = parse(req.url, true)
  const pathname = parsed.pathname

  const handler = handlers[pathname]
  if (handler) {
    try {
      await handler(wrapReq(req, parsed), wrapRes(res))
    } catch (e) {
      console.error(pathname, e)
      res.statusCode = 500
      res.end(JSON.stringify({ error: e.message }))
    }
  } else {
    res.statusCode = 404
    res.end('Not found')
  }
})

server.listen(8080, () => {
  console.log('Local API server running on http://localhost:8080')
})
