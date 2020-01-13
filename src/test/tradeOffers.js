const SteamBot = require('../scripts/Steam')
const account = require('../config/accounts/alanderlt')

const log = console.log.bind(console)

const bot = new SteamBot(account.userName, account.password, account.sharedSecret, account.identitySecret)
bot.setSteamId(account.steamid)
bot.setMachineAuth(account.machineAuth)
bot.setApiKey(account.apiKey)

bot
  .getAllTradeOffers()
  .then(log)
  .catch(log)
