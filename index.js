const request = require('request')
const RSA = require('./src/lib/RSA')
const getCode = require('./2fa')

async function login () {
  let code = await getCode('/ItRwbqDDoVXsurB8cBjw3nO+js=', {
    proxy: 'http://127.0.0.1:1080'
  })
  request.post(
    'https://store.steampowered.com/login/getrsakey/',
    {
      formData: {
        donotcache: new Date().getTime(),
        username: 'alanderlt'
      }
    },
    (err, response, keyBody) => {
      keyBody = JSON.parse(keyBody)
      let pubKey = RSA.getPublicKey(keyBody.publickey_mod, keyBody.publickey_exp)
      let password = RSA.encrypt('hairui321', pubKey)
      console.log(password)
      let loginParams = {
        password,
        username: 'alanderlt',
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
        'https://store.steampowered.com/login/dologin/',
        { form: loginParams },
        (err, res, loginBody) => {
          console.log(err, loginBody)
          console.log(res.headers)
        }
      )
    }
  )
}

login()
