const SteamBot = require('./src/scripts/Steam')
const account = require('./src/config/accounts/alanderlt')
const bot = new SteamBot(account.userName, account.password, account.sharedSecret, account.identitySecret)
bot.setSteamId(account.steamid)
bot.setMachineAuth(account.machineAuth)
bot.setApiKey(account.apiKey)
bot.setUniqueIdForPhone(account.uniqueIdForPhone)

// bot.get2faCode()
//   .then(console.log.bind(console))
bot
  .login()
  .then(() => bot.getAllTradeOffers())
  .then(tradeOffers => {
    console.log(tradeOffers)
    if (tradeOffers.length) {
      return bot.acceptTradeOffer(tradeOffers[0].id, tradeOffers[0].pid)
    }
    return '无交易报价'
  })
  .then(trade => {
    if (!trade.tradeid && trade['needs_mobile_confirmation']) {
      return bot.fetchAllConfirms()
    } else {
      return trade
    }
  })
  .then(confirmation => {
    console.log(confirmation)
  })
  .catch(err => {
    console.log(err)
  })
// bot
//   .login()
//   .then(() => bot.getAllTradeOffers())
//   .then(tradeOffers => {
//     console.log(tradeOffers)
//     return bot.acceptTradeOffer(tradeOffers[0].id, tradeOffers[0].pid)
//   })
//   .then(res => {
//     console.log(res, 'res')
//   })
//   .catch(err => {
//     console.log(err, 'err')
//   })

// bot
//   .login()
//   .then(() => bot.getAllTradeOffers())
//   .then(offers => {
//     console.log(offers)
//     if (offers.length) {
//         return bot.getTradeOfferDetail(offers[0].id)
//     } else {
//       null
//     }
//   })
//   .catch(console.log.bind(console))
