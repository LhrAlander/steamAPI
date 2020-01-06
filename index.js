const SteamBot = require('./src/scripts/Steam')

const bot = new SteamBot(
  'lhairui321',
  'hairui321',
  'EX3sgi1o6S4hES1qqAE8PuDumvI=',
  '17sypnHsAi2qMJTGJ/bb3oxwkcs='
)

bot.setSteamId('76561198844007113')
bot.setUniqueIdForPhone('android:d8d1e265-442d-4c45-8750-c0cf33afced9')
bot.setMachineAuth('1AB44C700E535E2E7E31B856B3D093CC7663BC7E')
bot
  .login()
  .then(() => {
    bot.getConfirmPage()
  })
