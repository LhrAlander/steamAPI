const request = require('request')
const cookieStr = `_ga=GA1.2.730098146.1561035956; timezoneOffset=28800,0; browserid=1056572687229856427; strInventoryLastContext=570_2; steamMachineAuth76561198237163950=ACE4ED2C8627E1716227CE13DC654D5C03CC4999; sessionid=92d2be57089f9dc76c5ad86c; steamCountry=US%7Cfd66f468c5cabf9a90bb05f177388655; steamLoginSecure=76561198329139129%7C%7C38E746B97EC0DE3B9829CEEF01F37DA79A293804; steamMachineAuth76561198329139129=F204E10F3127EF52A7195859195BDB166ABEBB31; steamRememberLogin=76561198329139129%7C%7C4e6f5d7a99ba4bc700666fe8f1f05d01; webTradeEligibility=%7B%22allowed%22%3A1%2C%22allowed_at_time%22%3A0%2C%22steamguard_required_days%22%3A15%2C%22new_device_cooldown_days%22%3A7%2C%22time_checked%22%3A1561207818%7D; tsTradeOffersLastRead=1561207690`
function acceptTrade (id) {
  const formData = {
    sessionid: '92d2be57089f9dc76c5ad86c',
    serverid: 1,
    tradeofferid: id,
    partner: '76561198877750588',
    captcha: ''
  }
  const j = request.jar()
  const cookie = request.cookie(cookieStr)
  const url = `https://steamcommunity.com/tradeoffer/${id}/accept`
  j.setCookie(cookie, url, (err, ck) => {})
  request.post(
    url,
    {
      formData,
      proxy: 'http://127.0.0.1:1080',
      headers: {
        'Referer': `https://steamcommunity.com/tradeoffer/${id}/`,
        'Cookie': cookieStr,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36'
      },
      jar: j
    },
    (err, res, body) => {
      console.log(res)
    }
  )
}

function test () {
  console.log(Buffer.from('{', 'utf-8'))
}
acceptTrade(3610761261)
// test()
