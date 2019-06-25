const request = require('request')
const fs = require('fs')
const path = require('path')

// const cookie = fs.readFileSync('./src/bot/alanderlt.txt').toString('utf-8')
// console.log(cookie)
const Steam = require('./src/scripts/Steam')
const steam = new Steam('alanderlt', 'hairui321', '/ItRwbqDDoVXsurB8cBjw3nO+js=')
steam.login()
  .then(() => {
    request.get('https://store.steampowered.com/account/', { headers: { 'Cookie': steam.cookieStr } }, (err, res, body) => {
      if (err) {
        console.log(err)
        return
      }
      fs.writeFile('i.html', body, err => {
        console.log(err)
      })
    })
  })
  .catch(err => {
    console.log(err)
  })
