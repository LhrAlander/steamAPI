import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

import * as request from 'request'

import struct from './util/struct'
import RSA from './util/RSA'
import _get2faCode from './util/get2faCode'
import {
	RSA_URL,
	SYNC_URL,
	CODE_CHARS,
	LOGIN_URL
} from './consts'

interface IRequest {
	response: request.Response,
	body: any
}

interface ILogin {
	password: string;
	username: string;
	twofactorcode: string;
	emailauth: string;
	loginfriendlyname: string;
	captchagid: number;
	captcha_text: string;
	emailsteamid: string;
	rsatimestamp: number;
	remember_login: boolean;
	donotcache: number
}

interface ISteamOption {
	proxy?: string;
	[key: string]: string;
}

export default class Steam {

	private username: string
	private password: string
	private secretKey: string
	private cookie: { [key: string]: string }
	private options: ISteamOption
	public cookieStr: string

	constructor(username, password, secretKey, options) {
		this.username = username
		this.password = password
		this.secretKey = secretKey
		this.cookie = {}
		this.options = Object.assign(options)
	}

	private curl(uri: string, options: request.CoreOptions): Promise<IRequest> {
		return new Promise((resolve, reject) => {
			if (this.options.proxy) {
				options.proxy = this.options.proxy
			}
			request(uri, options, (err, response, body) => {
				if (err) {
					reject(err)
				}
				resolve({ response, body })
			})
		})
	}

	private getLoginParams(): Promise<ILogin> {
		return new Promise(async (resolve, reject) => {
			if (!this.username) {
				reject('need username')
			}
			Promise.all([
				this.get2faCode(),
				this.curl(RSA_URL, { method: 'POST', formData: { donotcache: new Date().getTime(), username: this.username } })
			])
				.then(([code, { body }]) => {
					body = JSON.parse(body)
					let pubKey = RSA.getPublicKey(body.publickey_mod, body.publickey_exp)
					let password = RSA.encrypt(this.password, pubKey)
					if (!password) { throw new Error('encrypt failed') }
					resolve({
						password: (password as string),
						username: this.username,
						twofactorcode: code,
						emailauth: '',
						loginfriendlyname: '',
						captchagid: -1,
						captcha_text: '',
						emailsteamid: '',
						rsatimestamp: body.timestamp,
						remember_login: true,
						donotcache: new Date().getTime()
					})
				})
				.catch(err => {
					console.log(err)
					reject(err)
				})
		})
	}

	public get2faCode(): Promise<string> {
		if (!this.secretKey) {
			throw new Error('no secret key supported')
		}
		return new Promise((resolve, reject) => {
			this.curl(SYNC_URL, { method: 'POST' })
				.then(({ body }) => {
					const { response } = JSON.parse(body)
					const syncDelta = response.server_time - Math.floor(+new Date() / 1000)
					const timeStamp = Math.floor((Math.floor(+new Date() / 1000) + syncDelta) / 30)
					resolve(_get2faCode(timeStamp, this.secretKey))
				})
				.catch(err => {
					reject(err)
				})
		})
	}

	public async login(): Promise<void> {
		return new Promise(async (resolve, reject) => {
			if (!this.username) {
				reject('need username')
			}
			try {
				const loginParams = await this.getLoginParams()
				let { response, body } = await this.curl(LOGIN_URL, {
					method: 'POST',
					form: loginParams
				})
				body = JSON.parse(body)
				if (!body.success) {
					throw body
				}
				// tslint:disable-next-line:no-string-literal
				if (!body || !body['transfer_urls']) {
					throw new Error('get body failed')
				}
				Promise.all(
					// tslint:disable-next-line:no-string-literal
					body['transfer_urls'].map(url => {
						return new Promise((_res, _rej) => {
							this.curl(url, { body: body.transfer_parameters, json: true })
								.then(transferRes => {
									_res(transferRes.response)
								})
								.catch(err => {
									_rej(err)
								})
						}
						)
					}))
					.then((responses: any[]) => {
						responses.push(response)
						responses.forEach(_rp => {
							if (_rp.headers && _rp.headers['set-cookie']) {
								_rp.headers['set-cookie'].forEach((cookieStr: string) => {
									cookieStr = cookieStr.split(';')[0]
									const [key, value] = cookieStr.split('=')
									this.cookie[key.trim()] = value.trim()
								})
							}
						})
						let str = []
						Object.keys(this.cookie).forEach(k => {
							str.push(`${k}=${this.cookie[k]}`)
						})
						this.cookieStr = str.join(';')
						fs.writeFileSync(path.resolve(__dirname, `./bot/${this.username}.txt`), this.cookieStr)
						resolve()
					})
					.catch(err => {
						throw err
					})

			} catch (error) {
				console.log(error)
				reject(error)
			}

		})
	}

}
