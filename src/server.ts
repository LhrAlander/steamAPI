import * as fs from 'fs'

import * as request from 'request'

import Steam from './Steam'

let robot = new Steam('alanderlt', 'hairui321', '/ItRwbqDDoVXsurB8cBjw3nO+js=', { proxy: 'http://127.0.0.1:1080' })
robot.login()
	.then(() => {
		request.get('https://store.steampowered.com/account/', { headers: { Cookie: robot.cookieStr } }, (err, res, body) => {
			if (err) {
				console.log(err)
				return
			}
			fs.writeFile('i.html', body, err => {
				console.log(err)
			})
		})
	})