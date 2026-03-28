// 네이버 블로그/카페 검색 — 아파트 삶의 질 이야기 수집
export const config = { regions: ['icn1'] }

import { stripHtml, naverSearch, NAVER_BLOG, NAVER_CAFE } from './_utils.js'

const AD_KEYWORDS = ['업체','견적','시공','전문점','전문업체','이사업체','포장이사','이사청소','청소업체','입주청소','도배','장판','새시','인테리어 견적','인테리어 업체','커튼','블라인드','붙박이장','에어컨 청소','세탁기 청소','할인','이벤트','협찬','광고','무료 견적','출장']

function isCommercial(title) { return AD_KEYWORDS.some(kw => title.includes(kw)) }

export default async function handler(req, res) {
  const { aptName, location } = req.query
  if (!aptName) return res.status(400).json({ error: 'aptName이 필요해요' })
  if (!process.env.NAVER_CLIENT_ID) return res.status(500).json({ error: 'Naver API 키가 없어요' })

  const blogQ = [`${aptName} 임장`, `${aptName} 이사 왔어요`, `${aptName} 살면서`]
  const cafeQ = [location ? `${location} 육아` : `${aptName} 육아`, location ? `${location} 임장` : `${aptName} 임장 후기`]

  try {
    const [b1, b2, b3, c1, c2] = await Promise.all([
      naverSearch(NAVER_BLOG, blogQ[0], 5),
      naverSearch(NAVER_BLOG, blogQ[1], 5),
      naverSearch(NAVER_BLOG, blogQ[2], 5),
      naverSearch(NAVER_CAFE, cafeQ[0], 4),
      naverSearch(NAVER_CAFE, cafeQ[1], 4),
    ])
    const seen = new Set()
    const stories = [...b1, ...b2, ...b3, ...c1, ...c2]
      .filter(item => {
        const t = stripHtml(item.title)
        if (isCommercial(t) || seen.has(item.link)) return false
        seen.add(item.link)
        return true
      })
      .slice(0, 8)
      .map(item => ({
        title:       stripHtml(item.title),
        description: stripHtml(item.description),
        link:        item.link,
        source:      item.bloggername || item.cafename || '',
        date:        item.postdate || '',
      }))
    return res.json(stories)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
