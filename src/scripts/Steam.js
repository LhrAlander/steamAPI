const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const request = require('request')
const struct = require('python-struct')
const RSA = require('../lib/RSA')

const {
  RSA_URL,
  SYNC_URL,
  CODE_CHARS,
  LOGIN_URL,
  CONFIRM_PAGE_URL
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

Steam.prototype.setUniqueIdForPhone = function setUniqueIdForPhone(id) {
  this.uniqueIdForPhone = id
}

Steam.prototype.setMachineAuth = function setMachineAuth(id) {
  this.machineAuth = id
}

Steam.prototype.get2faCode = function get2faCode(serectKey, options = {}) {
  if (!serectKey) return ''
  return new Promise((resolve, reject) => {
    request.post(SYNC_URL, options, (err, response, body) => {
      if (err) {
        reject(err)
      } else {
        const { response } = JSON.parse(body)
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
        }
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
          { form: loginParams },
          async (loginErr, loginResponse, loginBody) => {
            if (loginErr) {
              reject(loginErr)
            }
            loginBody = JSON.parse(loginBody)
            let transfer = await this.transfer(loginBody['transfer_urls'][1], loginBody['transfer_parameters'])
            let transfer0 = await this.transfer(loginBody['transfer_urls'][0], loginBody['transfer_parameters'])
            request.get('https://steamcommunity.com/', { proxy: 'http://127.0.0.1:1080' }, (err, response, body) => {
              this.cookie = {}
              this.getCookie(loginResponse.headers)
              this.getCookie(transfer.headers)
              this.getCookie(transfer0.headers)
              this.getCookie(response.headers)
              this.getCookie(keyResponse.headers)
              this.cookie[`steamMachineAuth${this.steamId}`] = this.machineAuth
              let str = []
              Object.keys(this.cookie).forEach(k => {
                str.push(`${k}=${this.cookie[k]}`)
              })
              this.cookieStr = str.join(';')
              fs.writeFile(path.resolve(__dirname, `../bot/${this.username}.txt`), this.cookieStr, err => {
                console.log(err)
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
    request.post(uri, { body: params, json: true, proxy: 'http://127.0.0.1:1080' }, (err, res, body) => {
      if (err) {
        console.log(err)
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
  return crypto.createHmac('sha1', key).update(Buffer.from(dataBytes)).digest().toString('base64');
}

Steam.prototype.getConfirmUrl = function getConfirmUrl() {
  const t = parseInt((+new Date) / 1000)
  const p = this.uniqueIdForPhone
  const a = this.steamId
  const k = this.getConfirmationTimeHash(t, 'conf')
  const m = 'android'
  const tag = 'conf'
  return `${CONFIRM_PAGE_URL}?p=${p}&a=${a}&k=${k}&m=${m}&tag=${tag}&t=${t}`
}

Steam.prototype.getConfirmPage = function getConfirmPage() {
  let url = this.getConfirmUrl()
  console.log(url)
  return new Promise((gRes, gRej) => {
    request.post({
      url,
      headers: {
        'Cookie': this.cookieStr
      },
      proxy: 'http://127.0.0.1:1080'
    }, function (err, resp, body) {
      if (err) {
        console.log(err)
        gRej(err)
      } else {
        fs.writeFile(path.resolve(__dirname, `../confirmation.html`), body, err => {
          console.log(err)
          gRes()
        })
      }
    })
  })
}

module.exports = Steam
