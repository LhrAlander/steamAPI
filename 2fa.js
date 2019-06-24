const crypto = require('crypto')
const struct = require('python-struct')
const request = require('request')

function generateCode (key, timeStamp) {
  const CODE_CHARS = '23456789BCDFGHJKMNPQRTVWXY'
  const data = struct.pack('>Q', parseInt(timeStamp / 30))
  const hmac = crypto
    .createHmac('sha1', Buffer.from(key, 'base64'))
    .update(data)
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
  return code
}

function getCode (key, options = {}) {
  const SYNC_URL =
    'https://api.steampowered.com/ITwoFactorService/QueryTime/v0001'
  return new Promise((resolve, reject) => {
    request.post(SYNC_URL, options, (err, response, body) => {
      if (!err) {
        const { response } = JSON.parse(body)
        const syncDelta = response['server_time'] - parseInt(+new Date() / 1000)
        resolve(generateCode(key, parseInt(+new Date() / 1000) + syncDelta))
      } else {
        reject(err)
      }
    })
  })
}

module.exports = getCode
