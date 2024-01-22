import { beforeEach, describe, expect, it, test } from 'vitest'

import { Hitch, Hitchhiker } from './hitchhiker'
import { MockTransport } from './transport'

import { EchoServer, EchoClient, Quotes } from '@test/echo'

class Counter {
	count = 0

	tick(delay = 0) {
		return new Promise<number>(resolve =>
			setTimeout(() => resolve(++this.count), delay),
		)
	}
}

describe('Hitch', () => {
	let hitch: Hitch<Promise<number>>
	let counter: Counter
	let tick: () => Promise<number>
	beforeEach(() => {
		hitch = new Hitch()
		counter = new Counter()
		tick = () => counter.tick()
	})

	it('invokes given function', async () => {
		await expect(hitch.do(tick)).resolves.toEqual(1)
		await expect(hitch.do(tick)).resolves.toEqual(2)
	})

	it('rejects with error from the original work', async () => {
		const w = hitch.do(
			() =>
				new Promise((resolve, reject) => {
					setTimeout(() => {
						reject(Quotes.Burger)
					}, 0)
				}),
		)

		await expect(w).rejects.toThrow(Quotes.Burger)
	})

	it('returns previous execution if exists', async () => {
		const twoTicks = Promise.all([hitch.do(tick), hitch.do(tick)])
		await expect(twoTicks).resolves.toEqual([1, 1])
	})

	it('rejects on abort', async () => {
		const c = new AbortController()
		const w = hitch.do(tick, c.signal)

		c.abort()
		await expect(w).rejects.toThrow(c.signal.reason.message)
	})

	it('rejects if it is already aborted', async () => {
		const c = new AbortController()
		c.abort()

		expect(() => hitch.do(tick, c.signal)).toThrow(c.signal.reason.message)
	})

	it('rejects each waiters individually', async () => {
		const c1 = new AbortController()
		const w1 = hitch.do(tick, c1.signal)

		const c2 = new AbortController()
		const w2 = hitch.do(tick, c2.signal)

		const c3 = new AbortController()
		const w3 = hitch.do(tick, c3.signal)

		c2.abort()
		c3.abort()
		await Promise.all([
			expect(w1).resolves.toEqual(1),
			expect(w2).rejects.toThrow(c2.signal.reason.message),
			expect(w3).rejects.toThrow(c3.signal.reason.message),
		])
	})

	it('abort the original execution if there is no waiters', async () => {
		let n = 0
		const c = new AbortController()
		const w = hitch.do(s => {
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					reject('timeout')
				}, 1000)
				s.addEventListener('abort', () => {
					n++
					reject(Quotes.Burger)
				})
			})
		}, c.signal)

		c.abort()
		await expect(w).rejects.toThrow(c.signal.reason.message)
		expect(n).toBe(1)
	})

	it('never abort the original execution if there is indefinite waiter', async () => {
		const w1 = hitch.do(tick)

		const c2 = new AbortController()
		const w2 = hitch.do(tick, c2.signal)

		const c3 = new AbortController()
		const w3 = hitch.do(tick, c3.signal)

		c2.abort()
		c3.abort()
		await Promise.all([
			expect(w1).resolves.toEqual(1),
			expect(w2).rejects.toThrow(c2.signal.reason.message),
			expect(w3).rejects.toThrow(c3.signal.reason.message),
		])
	})
})

describe('Hitchhiker', () => {
	test('all', async () => {
		let cnt = 0
		const t = new MockTransport(new EchoServer(), {
			interceptors: [
				new Hitchhiker<EchoServer>(({ all }) => ({
					hello: all(),
				})),
				{
					interceptUnary(next, method, input, options) {
						cnt++
						return next(method, input, options)
					},
				},
			],
		})

		const c = new EchoClient(t)
		await Promise.all([
			c.hello({ value: Quotes.WhatIsYourName }),
			c.hello({ value: Quotes.CanYouSpellIt }),
		])
		expect(cnt).toBe(1)
	})

	test('by key', async () => {
		const cnt = {
			[Quotes.WhatIsYourName]: 0,
			[Quotes.CanYouSpellIt]: 0,
		}
		const t = new MockTransport(new EchoServer(), {
			interceptors: [
				new Hitchhiker<EchoServer>(({ byKey }) => ({
					hello: byKey(input => {
						if (input.value === Quotes.CanYouSpellIt) {
							return undefined
						}
						return input.value
					}),
				})),
				{
					interceptUnary(next, method, input, options) {
						if (
							'value' in input &&
							typeof input.value === 'string' &&
							input.value in cnt
						) {
							cnt[input.value]++
						}

						return next(method, input, options)
					},
				},
			],
		})

		const c = new EchoClient(t)
		await Promise.all([
			c.hello({ value: Quotes.WhatIsYourName }),
			c.hello({ value: Quotes.WhatIsYourName }),
			c.hello({ value: Quotes.CanYouSpellIt }),
			c.hello({ value: Quotes.CanYouSpellIt }),
		])
		expect(cnt[Quotes.WhatIsYourName]).toBe(1)
		expect(cnt[Quotes.CanYouSpellIt]).toBe(2)
	})
})
