import { describe, expect, it, test } from 'vitest'

import { MockTransport } from './transport'

import { EchoClient, EchoServer, Quotes } from './echo'

describe('MockTransport', () => {
	it('forwards inputs to target client', async () => {
		const t = new MockTransport(new EchoServer())
		const c = new EchoClient(t)

		await expect(
			c.hello({ value: Quotes.Burger }).response,
		).resolves.toEqual({
			value: Quotes.Burger,
		})
	})

	it('respects interceptors', async () => {
		let cnt = 0
		const t = new MockTransport(new EchoServer(), {
			interceptors: [
				{
					interceptUnary(next, method, input, options) {
						cnt++
						return next(method, input, options)
					},
				},
			],
		})

		const c = new EchoClient(t)
		await c.hello({ value: Quotes.Burger })
		expect(cnt).toBe(1)
	})
})
