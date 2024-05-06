import { describe, expect, it } from 'vitest'

import { Cacher } from './cacher'
import { MockTransport } from './transport'

import { EchoClient, EchoServer, Quotes } from './echo'

describe('Cacher', () => {
	it('returns cached value on cache hit', async () => {
		const t = new MockTransport(new EchoServer(), {
			interceptors: [
				new Cacher<EchoServer>(({ byKey }) => ({
					hello: byKey(() => 'xo'),
				})),
			],
		})

		const c = new EchoClient(t)
		await expect(
			c.hello({ value: Quotes.WhatIsYourName }).response,
		).resolves.toEqual({
			value: Quotes.WhatIsYourName,
		})
		await expect(
			c.hello({ value: Quotes.CanYouSpellIt }).response,
		).resolves.toEqual({
			value: Quotes.WhatIsYourName,
		})
	})

	it('returns header with status 304', async () => {
		const t = new MockTransport(new EchoServer(), {
			interceptors: [
				new Cacher<EchoServer>(({ byKey }) => ({
					hello: byKey(msg => msg.value),
				})),
			],
		})

		const c = new EchoClient(t)
		c.hello({ value: Quotes.WhatIsYourName })
		await expect(
			c.hello({ value: Quotes.WhatIsYourName }).headers,
		).resolves.not.toHaveProperty('status', '304')
		await expect(
			c.hello({ value: Quotes.WhatIsYourName }).headers,
		).resolves.toHaveProperty('status', '304')
	})
})
