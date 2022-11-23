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
      ctx.logger.warn('[amqp] doubleLine stock multi element strategy error: ', msg.id, id, err)
    }
  }

  async doTrade (id, ctx) {
    const stock = await ctx.models.CciDmaStock.findByPk(id)
    if (!stock) {
      ctx.logger.warn('[amqp] doubleLine stock multi element strategy error: stock not found ', id)
      return
    }
    const { currentWorth } = await ctx.stock.getCurrentInfo(stock.code)
    const firstElementValue = await ctx.stock.loadMaData({
      code: stock.code,
      limit: stock.dmaFirstElementDays,
      deflate: item => item.close
    })
    const secondElementValue = await ctx.stock.loadMaData({
      code: stock.code,
      limit: stock.dmaSecondElementDays,
      deflate: item => item.close
    })
    await ctx.models.CciDmaStock.update({
      currentWorth,
      dmaFirstElementValue: firstElementValue,
      dmaSecondElementValue: secondElementValue,
      dmaDiff: firstElementValue - secondElementValue
    }, {
      where: { id }
    })
    const [{
      close, open, high, low
    }] = await ctx.stock.loadDataFromPrevNDays(stock.code, 1)
    await ctx.models.CciDmaStock.writeDailyReport(id, {
      close,
      open,
      high,
      low,
      dmaFirstElementValue: firstElementValue,
      dmaSecondElementValue: secondElementValue,
      dmaDiff: firstElementValue - secondElementValue
    }, ctx)
  }
}
