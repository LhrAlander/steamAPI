import * as crypto from 'crypto'

import struct from './struct'
import { CODE_CHARS } from '../consts'

function get2faCode(timestamp, secretKey): string {
	if (!secretKey) {
		throw new Error('no secret key supported')
	}
	if (!secretKey) {
		throw new Error('no timestamp supported')
	}
	const hmac = crypto
		.createHmac('sha1', Buffer.from(secretKey, 'base64'))
		.update(struct.pack('>Q', timestamp))
		.digest()
	// tslint:disable-next-line:no-bitwise
	const start = hmac[19] & 0xf
	// tslint:disable-next-line:no-bitwise
	let codeInt = struct.unpack('>I', hmac.subarray(start, start + 4))[0] & 0x7fffffff
	let code:string = ''
	for (let i = 0; i < 5; i++) {
		let index = codeInt % CODE_CHARS.length
		codeInt = Math.floor(codeInt / CODE_CHARS.length)
		code += CODE_CHARS[index]
	}
 return code
}

export default get2faCode
