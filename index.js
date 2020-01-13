const SteamBot = require('./src/scripts/Steam')
const account = require('./src/config/accounts/alanderlt')
const bot = new SteamBot(account.userName, account.password, account.sharedSecret, account.identitySecret)
bot.setSteamId(account.steamid)
bot.setMachineAuth(account.machineAuth)
// bot.get2faCode()
//   .then(console.log.bind(console))
// bot
//   .login()
//   .then(() => bot.fetchAllConfirms())
//   .then(confirms => {
//     console.log(confirms)
//     return bot.acceptConfirm(confirms[0])
//   })
//   .then(console.log.bind(console))
//   .catch(err => {
//     console.log(err)
//   })
// bot
//   .login()
//   .then(() => bot.getAllTradeOffers())
//   .then(async tradeOffers => {
//     console.log(tradeOffers)
//     let res = await bot.acceptTradeOffer(tradeOffers[0].id, tradeOffers[0].pid)
//     console.log(res)
//   })
//   .catch(err => {
//     console.log(err)
//   })

bot
  .login()
  .then(() => bot.getAllTradeOffers())
  .then(offers => {
    console.log(offers)
    if (offers.length) {
        return bot.getTradeOfferDetail(offers[0].id)
    } else {
      null
    }
  })
  .catch(console.log.bind(console))
