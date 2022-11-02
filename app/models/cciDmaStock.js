const _ = require('lodash')
const { startOfToday } = require('date-fns')

module.exports = Model => {
  return class extends Model {
    // eslint-disable-next-line consistent-return
    static async remoteCreate (ctx) {
      const { request: { body } } = ctx
      const instances = await this.findAll({
        where: {
          code: body.code,
          cciFirstElementDays: body.cciFirstElementDays || 14,
          cciSecondElement: body.cciSecondElement || 0.015,
          dmaFirstElementDays: body.dmaFirstElementDays || 11,
          dmaSecondElementDays: body.dmaSecondElementDays || 22
        },
        raw: true
      })
      if (instances && instances.length) {
        ctx.throw(400, `existing stock ${body.code}`)
      }
      try {
        const currentRet = await ctx.service.stock.getCurrentInfo(body.code, ctx)
        ctx.logger.info('stock current info: ', body.code, currentRet)
        ctx.request.body.currentWorth = currentRet.currentWorth
        return super.remoteCreate(ctx)
      } catch (err) {
        ctx.logger.info('create stock error: ', err)
        ctx.throw(400, 'stock create error')
      }
    }

    static async buy (id, data, ctx) {
      const trx = await this.dataSource.transaction()
      try {
        ctx.assert(data.price, 400, 'price is required')
        const operateAt = await ctx.models.Holiday.getNextTradeDate(Date.now(), ctx)
        await ctx.models.CciDmaStockTradeLog.create({
          type: 'BUY',
          ...data,
          cciDmaStockId: id,
          operateAt
        }, { transaction: trx })
        await this.update({
          latestBuyPrice: data.price,
          isHolding: true
        }, {
          where: { id }
        }, { transaction: trx })
        await trx.commit()
        ctx.logger.info('cciDmaStock buy stock: ', id, data)
      } catch (err) {
        await trx.rollback()
        ctx.logger.warn('cciDmaStock buy stock error: ', id, err)
      }
    }

    static async sell (id, data, ctx) {
      const trx = await this.dataSource.transaction()
      try {
        ctx.assert(data.price, 400, 'price is required')
        const operateAt = await ctx.models.Holiday.getNextTradeDate(Date.now(), ctx)
        await ctx.models.CciDmaStockTradeLog.create({
          type: 'SELL',
          ...data,
          cciDmaStockId: id,
          operateAt
        }, { transaction: trx })
        await this.update({
          isHolding: false,
          latestSellPrice: data.price
        }, {
          where: { id }
        }, { transaction: trx })
        await trx.commit()
        ctx.logger.info('cciDmaStock sale stock: ', id, data)
      } catch (err) {
        await trx.rollback()
        ctx.logger.warn('cciDmaStock sale stock error: ', id, err)
      }
    }

    static async backTest (id, {
      data,
      isEnterPosition,
      isExitPosition
    }, ctx) {
      ctx.assert(id, 'stockId is required')
      ctx.logger.info('cci stock backTest: ', id, {
        isEnterPosition, isExitPosition
      })
      if (isEnterPosition) {
        await this.buy(id, data, ctx)
      }
      if (isExitPosition) {
        await this.sell(id, data, ctx)
      }
    }

    static async writeDailyReport (id, list, ctx) {
      if (!(await ctx.models.Holiday.isHoliday(ctx))) {
        const { modelDef } = ctx.models.CciDmaStockLog
        const definedFields = _.remove(Object.keys(modelDef.properties || {}), field => {
          return !['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(field)
        })
        const date = startOfToday().getTime()
        await ctx.models.CciDmaStockLog.bulkCreate(list.map(item => ({
          ...item,
          id: `${id}${date}`,
          date,
          cciDmaStockId: id
        })), {
          updateOnDuplicate: definedFields
        })
      }
    }
  }
}
