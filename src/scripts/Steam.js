const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const request = require('request')
const struct = require('python-struct')
const cheerio = require('cheerio')
const bigInteger = require('big-integer')

const RSA = require('../lib/RSA')

const {
  RSA_URL,
  SYNC_URL,
  CODE_CHARS,
  LOGIN_URL,
  ACCEPT_CONFIRM,
  CONFIRM_PAGE_URL,
  TRADE_OFFERS,
  ACCEPT_TRADE_OFFER
} = require('../config/urls')

/**
 *
 * @param {*} username
 * @param {*} password
 * @param {?可选} serectKey
 */
function Steam(username, password, serectKey, identitySecret) {
  this.username = username
  this.password = password
  this.serectKey = serectKey
  this.cookie = {}
  this.identitySecret = identitySecret
}

Steam.prototype.setSteamId = function setSteamId(id) {
  this.steamId = id
}

Steam.prototype.setApiKey = function setApiKey(key) {
  this.apiKey = key
}

Steam.prototype.setUniqueIdForPhone = function setUniqueIdForPhone(id) {
  this.uniqueIdForPhone = id
}

Steam.prototype.setMachineAuth = function setMachineAuth(id) {
  this.machineAuth = id
}

Steam.prototype.get2faCode = function get2faCode(serectKey, options = {}) {
  serectKey = serectKey || this.serectKey
  return new Promise((resolve, reject) => {
    if (!serectKey) return resolve('')
    request.post(SYNC_URL, options, (err, response, body) => {
      if (err) {
        reject(err)
      } else {
        const {response} = JSON.parse(body)
        const syncDelta = response['server_time'] - parseInt(+new Date() / 1000)
        const timeStamp = parseInt((parseInt(+new Date() / 1000) + syncDelta) / 30)
        const hmac = crypto
          .createHmac('sha1', Buffer.from(serectKey, 'base64'))
          .update(struct.pack('>Q', timeStamp))
          .digest()
        const start = hmac[19] & 0xf
        let codeInt =
          struct.unpack('>I', hmac.subarray(start, start + 4))[0] & 0x7fffffff
        let code = ''
        for (let i = 0; i < 5; i++) {
          let index = codeInt % CODE_CHARS.length
          codeInt = parseInt(codeInt / CODE_CHARS.length)
          code += CODE_CHARS[index]
        }
        resolve(code)
      }
    })
  })
}

Steam.prototype.login = function login() {
  return new Promise((resolve, reject) => {
    if (!this.username) {
      reject('need username')
    }
    request.post(
      RSA_URL,
      {
        formData: {
          donotcache: new Date().getTime(),
          username: this.username
        },
        proxy: 'http://127.0.0.1:1080'
      },
      async (keyErr, keyResponse, keyBody) => {
        if (keyErr) {
          reject(keyErr)
        }
        keyBody = JSON.parse(keyBody)
        let pubKey = RSA.getPublicKey(keyBody.publickey_mod, keyBody.publickey_exp)
        let password = RSA.encrypt(this.password, pubKey)
        const code = await this.get2faCode(this.serectKey)
        let loginParams = {
          password,
          username: this.username,
          twofactorcode: code,
          emailauth: '',
          loginfriendlyname: '',
          captchagid: -1,
          captcha_text: '',
          emailsteamid: '',
          rsatimestamp: keyBody.timestamp,
          remember_login: true,
          donotcache: new Date().getTime()
        }
        request.post(
          LOGIN_URL,
          {
            form: loginParams,
            proxy: 'http://127.0.0.1:1080'
          },
          async (loginErr, loginResponse, loginBody) => {
            if (loginErr) {
              reject(loginErr)
            }
            loginBody = JSON.parse(loginBody)
            let transfer = await this.transfer(loginBody['transfer_urls'][1], loginBody['transfer_parameters'])
            let transfer0 = await this.transfer(loginBody['transfer_urls'][0], loginBody['transfer_parameters'])
            request.get('https://steamcommunity.com/', {proxy: 'http://127.0.0.1:1080'}, (err, response, body) => {
              this.cookie = {}
              this.getCookie(loginResponse.headers)
              this.getCookie(transfer.headers)
              this.getCookie(transfer0.headers)
              this.getCookie(response.headers)
              this.getCookie(keyResponse.headers)
              this.cookie[`steamMachineAuth${this.steamId}`] = this.machineAuth
              this.cookie.webTradeEligibility = encodeURIComponent(JSON.stringify({
                allowed: 1,
                'allowed_at_time': 0,
                'steamguard_required_days': 15,
                'new_device_cooldown_days': 7,
                'time_checked': parseInt((+new Date()) / 1000)
              }))
              let str = []
              Object.keys(this.cookie).forEach(k => {
                str.push(`${k}=${this.cookie[k]}`)
              })
              this.cookieStr = str.join(';')
              fs.writeFile(path.resolve(__dirname, `../bot/${this.username}.txt`), this.cookieStr, err => {
                resolve()
              })
            })
          }
        )
      }
    )
  })
}

Steam.prototype.transfer = function transfer(uri, params) {
  return new Promise((resolve, reject) => {
    request.post(uri, {body: params, json: true, proxy: 'http://127.0.0.1:1080'}, (err, res, body) => {
      if (err) {
        reject(err)
      }
      resolve(res)
    })
  })
}

Steam.prototype.getCookie = function getCookie(header) {
  if (!header['set-cookie']) return
  header['set-cookie'].forEach(str => {
    str = str.split(';')[0]
    const [key, value] = str.split('=')
    this.cookie[key.trim()] = value.trim()
  })
}

Steam.prototype.getConfirmationTimeHash = function getConfirmationTimeHash(time, tag) {
  function int2byte(s) {
    s = s.toString(2)
    if (s.length < 9) {
      for (let i = s.length; i < 9; i++) {
        s = '0' + s
      }
    }
    s = s.slice(s.length - 8, s.length)
    if (s[0] === '1') {
      return -1 * ((parseInt(s, 2) ^ 0xFF) + 1)
    }
    return parseInt(s, 2)
  }

  const key = Buffer.from(this.identitySecret, 'base64')
  const tBytes = Array.prototype.slice.call(new Buffer(tag), 0)
  let dataLen = 8
  if (tag) {
    dataLen = tag.length > 32 ? 40 : 8 + tag.length
  }
  const dataBytes = []
  let i = 8
  while (i--) {
    dataBytes[i] = int2byte(time)
    time >>>= 8
  }
  for (let i = 0; i < dataLen - 8; i++) {
    dataBytes[i + 8] = tBytes[i]
  }
  return crypto.createHmac('sha1', key).update(Buffer.from(dataBytes)).digest().toString('base64')
}

Steam.prototype.getConfirmUrl = function getConfirmUrl(url, tag) {
  const t = parseInt((+new Date) / 1000)
  const p = this.uniqueIdForPhone
  const a = this.steamId
  const k = this.getConfirmationTimeHash(t, tag)
  const m = 'android'
  return `${url}?p=${p}&a=${a}&k=${k}&m=${m}&tag=${tag}&t=${t}`
}

Steam.prototype.getConfirmPage = function getConfirmPage() {
  let url = this.getConfirmUrl(CONFIRM_PAGE_URL, 'conf')
  return new Promise((gRes, gRej) => {
    request.post({
      url,
      headers: {
        'Cookie': this.cookieStr
      },
      proxy: 'http://127.0.0.1:1080'
    }, function (err, resp, body) {
      if (err) {
        gRej(err)
      } else if (resp.statusCode === 401 || resp.statusCode === 403) {
        console.log('重新登陆')
        gRej('relogin')
      } else {
        gRes(body)

      }
    })
  })
}

Steam.prototype.fetchAllConfirms = function fetchAllConfirms() {
  function parseHtml(htmlTxt) {
    const $ = cheerio.load(htmlTxt)
    const confirms = []
    $('#mobileconf_list .mobileconf_list_entry')
      .each(function (i, entry) {
        const cid = $(this).attr('data-confid')
        const ck = $(this).attr('data-key')
        const goodsName = $(this).find('.mobileconf_list_entry_description div span').text()
        confirms.push({
          cid,
          ck,
          goodsName
        })
      })
    return confirms
  }

  return new Promise((gRes, gRej) => {
    this.getConfirmPage()
      .then((body) => {
        fs.writeFile(path.resolve(__dirname, `../templates/confirmation-${+new Date()}.html`), body, err => {
          if (err) {
            gRej(err)
          }
          let confirms = parseHtml((body))
          gRes(confirms)
        })
      })
      .catch(err => {
        gRej(err)
      })

  })
}

// 移动端确认
Steam.prototype.acceptConfirm = function acceptConfirm(confirm) {
  const url = this.getConfirmUrl(ACCEPT_CONFIRM, 'allow') + `&op=allow&cid=${confirm.cid}&ck=${confirm.ck}`
  return new Promise((gRes, gRej) => {
    request.post({
      url,
      headers: {
        'Cookie': this.cookieStr
      },
      proxy: 'http://127.0.0.1:1080'
    }, function (err, resp, body) {
      if (err) {
        gRej(err)
      } else {
        console.log(resp.statusCode, body)
        body = JSON.parse(body)
        gRes(body)
      }
    })
  })
}

// 获取所有交易报价
Steam.prototype.getAllTradeOffers = async function getAllTradeOffers() {

  return new Promise((gRes, gRej) => {
    function getTradeOfferItem(classid, instanceid) {
      const url = `https://steamcommunity.com/economy/itemclasshover/570/${classid}/${instanceid}?content_only=1&l=schinese`
      return new Promise((res, rej) => {
        request(url,
          {
            proxy: 'http://127.0.0.1:1080'
          },
          (err, resp, body) => {
            if (err) {
              rej(err)
            } else {
              try {
                let jsonObj = body.match(/BuildHover\([^,]*,\s*([^)]*)\)/)[1].trim()
                res({
                  classid,
                  instanceid,
                  name: decodeURI(JSON.parse(jsonObj).name)
                })
              } catch (e) {
                rej(e)
              }
            }
          }
        )
      })
    }

    const apiUrl = `https://api.steampowered.com/IEconService/GetTradeOffers/v1/?key=${this.apiKey}&get_received_offers=true&active_only=true`
    request(apiUrl, {
      proxy: 'http://127.0.0.1:1080',
      json: true
    }, (err, resp, body) => {
      if (err) {
        gRej(err)
      } else {
        const offers = body.response['trade_offers_received'].map(_ => {
          return {
            id: _.tradeofferid,
            pid: bigInteger('76561197960265728').add(bigInteger(_['accountid_other'])).toString(),
            item: _['items_to_receive'][0]
          }
        })
        let promises = []
        for (let i = 0, l = offers.length; i < l; i++) {
          let item = offers[i].item
          promises.push(getTradeOfferItem(item.classid, item.instanceid))
        }
        Promise
          .all(promises)
          .then(items => {
            items.forEach((_, i) => {
              offers[i].item = _
            })
            gRes(offers)
          })
          .catch(err => {
            gRej(err)
          })
      }
    })
  })
}

// 确认交易报价
Steam.prototype.acceptTradeOffer = function acceptTradeOffer(id, pid) {
  const url = ACCEPT_TRADE_OFFER.replace('{id}', id)
  const params = {
    sessionid: this.cookie.sessionid,
    serverid: 1,
    tradeofferid: id,
    partner: pid
  }
  return new Promise((gRes, gRej) => {
    request.post(url, {
      form: params,
      headers: {
        Cookie: this.cookieStr,
        Referer: 'https://steamcommunity.com/tradeoffer/${id}/'
      },
      proxy: 'http://127.0.0.1:1080'
    }, function (err, resp, body) {
      if (err) {
        gRej(err)
      } else {
        gRes(body)
      }
    })
  })
}

// 查询报价具体内容
Steam.prototype.getTradeOfferDetail = function getTradeOfferDetail(id) {
  const url = `https://steamcommunity.com/tradeoffer/${id}`

  function parseHtml(htmlText) {
    const $ = cheerio.load(htmlText)
    let name = $('#trade_hover #hover_item_name').text()
    console.log(name)
  }

  return new Promise((gRes, gRej) => {
    request(
      url,
      {
        headers: {
          Cookie: this.cookieStr
        },
        proxy: 'http://127.0.0.1:1080'
      },
      (err, resp, body) => {
        if (err) {
          gRej(err)
        } else {
          fs.writeFileSync('tradeDetail.html', body)
          parseHtml(body)
          gRes()
        }
      }
    )
  })
}

module.exports = Steam
