const SteamBot = require('../scripts/Steam')
const account = require('../config/accounts/alanderlt')

const log = console.log.bind(console)

const bot = new SteamBot(account.userName, account.password, account.sharedSecret, account.identitySecret)
bot.setSteamId(account.steamid)
bot.setMachineAuth(account.machineAuth)
bot.setApiKey(account.apiKey)

bot
  .getAllTradeOffers()
  .then(_ => log(JSON.stringify(_)))
  .catch(log)

const a = {
  'id': '3870173328',
  'pid': '76561198329139129',
  'receiveItems': [],
  'giveItems': [{'classid': '57939556', 'instanceid': '0', 'name': 'Berserker\'s Pauldron'}],
  'partenerInfo': {'name': '又是你？', 'createTime': 1472959348}
}