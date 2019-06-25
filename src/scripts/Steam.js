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
  LOGIN_URL
} = require('../config/urls')

/**
 * 
 * @param {*} username 
 * @param {*} password 
 * @param {?可选} serectKey 
 */
function Steam(username, password, serectKey) {
  this.username = username
  this.password = password
  this.serectKey = serectKey,
  this.cookie = {}
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

Steam.prototype.transfer = function transfer (uri, params) {
  return new Promise ((resolve, reject) => {
    request.post(uri, {body: params, json: true, proxy: 'http://127.0.0.1:1080'}, (err, res, body) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      resolve(res)
    })
  })
}

Steam.prototype.getCookie = function getCookie (header) {
  if (!header['set-cookie']) return
  header['set-cookie'].forEach(str => {
    str = str.split(';')[0]
    const [key, value] = str.split('=')
    this.cookie[key.trim()] = value.trim()
  })
}

module.exports = Steam
