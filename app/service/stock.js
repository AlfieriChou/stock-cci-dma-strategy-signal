const got = require('got')

const url = 'https://qt.gtimg.cn/q='
const sinaUrl = 'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData'

module.exports = class Stock {
  getMarketCode (code) {
    if (code.startsWith('6') || code.startsWith('5')) {
      return `sh${code}`
    }
    return `sz${code}`
  }

  // eslint-disable-next-line consistent-return
  async getCurrentInfo (code, ctx) {
    const marketCode = this.getMarketCode(code)
    try {
      const data = await got(`${url}${marketCode}`, {
        resolveBodyOnly: true
      })
      const [, name, , currentWorth] = data.split('="')[1].split('~')
      return {
        code, name, currentWorth: parseFloat(currentWorth)
      }
    } catch (err) {
      ctx.logger.info('get stock current info error: ', code, err)
      ctx.throw(400, err)
    }
  }

  // eslint-disable-next-line consistent-return
  async loadHistoryData ({ code, dataLen, scale }, ctx) {
    try {
      const ret = await got(sinaUrl, {
        resolveBodyOnly: true,
        responseType: 'json',
        searchParams: {
          scale: scale || 60,
          ma: 60,
          symbol: this.getMarketCode(code),
          datalen: dataLen
        }
      })
      return ret
    } catch (err) {
      ctx.logger.info('获取stock信息异常', code, err)
      ctx.throw(400, err)
    }
  }

  async loadDataFromPrevNDays (code, n, ctx) {
    const ret = await this.loadHistoryData({
      code, dataLen: n, scale: 240
    }, ctx)
    return ret
      .map(item => {
        return {
          day: item.day,
          close: parseFloat(item.close),
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low)
        }
      })
  }

  ma ({
    list, deflate, limit
  }) {
    const total = list.reduce((sum, item) => sum + deflate(item), 0)
    return parseFloat((total / limit).toFixed(4))
  }

  async loadMaData ({
    code, limit, deflate
  }, ctx) {
    ctx.assert(deflate, 'deflate is required')
    ctx.assert(code, 'code is required')
    ctx.assert(limit, 'limit is required')
    const list = await ctx.service.stock.loadDataFromPrevNDays(code, limit, ctx)
    ctx.logger.info('loadMaData: ', code, limit, list)
    return this.ma({ list, deflate, limit })
  }

  async loadMdData ({
    code, limit, deflate
  }, ctx) {
    ctx.assert(deflate, 'deflate is required')
    ctx.assert(code, 'code is required')
    ctx.assert(limit, 'limit is required')
    const list = await ctx.service.stock.loadDataFromPrevNDays(code, 2 * limit, ctx)
    ctx.logger.info('loadMdData: ', code, limit, list)
    const maList = list.slice(limit, 2 * limit)
      .map((item, index) => {
        const ma = this.ma({
          list: list.slice(index, limit + index),
          deflate: item => item.close,
          limit
        })
        return {
          ...item,
          ma
        }
      })
    return this.ma({ list: maList, deflate, limit })
  }
}
