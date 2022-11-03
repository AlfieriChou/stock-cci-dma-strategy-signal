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
      ctx.logger.warn('[amqp] back test error: ', msg.id, id, err)
    }
  }

  async doTrade (id, ctx) {
    const stock = await ctx.models.CciDmaStock.findByPk(id)
    if (!stock) {
      ctx.logger.warn('[amqp] back test error: stock not found ', id)
      return
    }
    const {
      currentWorth, cci, dmaDiff,
      dmaFirstElementValue, dmaSecondElementValue,
      isHolding
    } = stock
    const isEnterPosition = cci > -100 && cci < 100 && dmaDiff >= 0
    await ctx.models.CciDmaStock.backTest(id, {
      data: {
        price: currentWorth,
        operateLog: {
          cci,
          dmaDiff,
          dmaFirstElementValue,
          dmaSecondElementValue
        }
      },
      isEnterPosition,
      isExitPosition: !isEnterPosition && isHolding
    }, ctx)
  }
}
