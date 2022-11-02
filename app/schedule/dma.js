exports.schedule = {
  time: '0 40 15/19 * * *'
}

exports.task = async ctx => {
  const startAt = Date.now()
  ctx.logger.info('dma交易策略定时任务.开始')
  const incr = await ctx.redis.incr('main', 'dma', 10)
  if (incr > 1) {
    return
  }
  const instances = await ctx.models.CciDmaStock.findAll({
    limit: 100,
    raw: true
  })
  if (instances.length) {
    await instances.reduce(async (promise, stock) => {
      await promise
      await ctx.sendMsg('dma', 'STOCK', {
        id: stock.id
      })
    }, Promise.resolve())
  }
  ctx.logger.info('dma交易策略定时任务.结束', Date.now() - startAt)
}
