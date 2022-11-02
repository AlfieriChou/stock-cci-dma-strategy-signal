module.exports = class Trade {
  async onMsg (msg, ctx) {
    const duplicateCount = await ctx.redis.incr(
      'main',
      `consumerMessageId:${msg.id}`,
      5 * 60
    )
    if (duplicateCount > 1) {
      ctx.logger.info('[amqp] duplicate message ', msg.id)
      return
    }
    const { id } = msg.body
    try {
      await this.doTrade(id, ctx)
    } catch (err) {
      ctx.logger.warn('[amqp] cci stock multi element strategy error: ', msg.id, id, err)
    }
  }

  async doTrade (id, ctx) {
    const stock = await ctx.models.CciDmaStock.findByPk(id)
    if (!stock) {
      ctx.logger.warn('[amqp] cci stock multi element strategy error: stock not found ', id)
      return
    }
    const { currentWorth } = await ctx.service.stock.getCurrentInfo(stock.code, ctx)
    const [{
      close, open, high, low
    }] = await ctx.service.stock.loadDataFromPrevNDays(stock.code, 1, ctx)
    const ma = await ctx.service.stock.loadMaData({
      code: stock.code,
      limit: stock.cciFirstElementDays,
      deflate: item => item.close
    }, ctx)
    const md = await ctx.service.stock.loadMdData({
      code: stock.code,
      limit: stock.cciFirstElementDays,
      deflate: item => item.ma - item.close
    }, ctx)
    const tp = parseFloat(((close + high + low) / 3).toFixed(4))
    const cci = (tp - ma) / md / stock.cciSecondElement
    await ctx.models.CciDmaStock.update({
      currentWorth,
      cci
    }, {
      where: { id }
    })
    await ctx.models.CciDmaStock.writeDailyReport(id, [{
      close, open, high, low, cci
    }], ctx)
  }
}
