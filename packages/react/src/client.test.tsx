import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { EchoClient, EchoServer, Quotes } from '@test/echo'
import { MockTransport } from 'grpc-concierge'

import { createClientHook } from './client'

describe('createClient', async () => {
	it('returns RPC client with provided transport', async () => {
		let n = 0
		const t = new MockTransport(new EchoServer(), {
			interceptors: [
				{
					interceptUnary(next, method, input, options) {
						n++
						return next(method, input, options)
					},
				},
			],
		})

		const [ctx, useClient] = createClientHook(EchoClient)
		const C: React.FC = () => {
			const c = useClient()
			c.hello({ value: Quotes.Burger })
			return <></>
		}

		render(
			<ctx.Provider value={t}>
				<C />
			</ctx.Provider>,
		)

		expect(n).toBe(1)
	})

	it('rendered when dependents RPC is invoked', async () => {
		const t = new MockTransport(new EchoServer())

		let n = 0
		const [ctx, useClient] = createClientHook(EchoClient, {
			hello: ['hola'],
		})
		const C: React.FC = () => {
			const c = useClient()
			c.hello({ value: Quotes.Burger })
			n++
			return (
				<>
					<button
						type='button'
						onClick={() => c.hola({ value: Quotes.CanYouSpellIt })}>
						Hola
					</button>
					<button
						type='button'
						onClick={() =>
							c.konnichiwa({ value: Quotes.WhatIsYourName })
						}>
						Konnichiwa
					</button>
				</>
			)
		}

		render(
			<ctx.Provider value={t}>
				<C />
			</ctx.Provider>,
		)
		expect(n).toBe(1)

		await userEvent.click(screen.getByText('Hola'))
		expect(n).toBe(2)

		await userEvent.click(screen.getByText('Konnichiwa'))
		expect(n).toBe(2)
	})

	it('aborts the RPC if it is unmounted', async () => {
		const t = new MockTransport(new EchoServer())

		let n = 0
		const [ctx, useClient] = createClientHook(EchoClient)
		const C: React.FC = () => {
			const c = useClient()
			c.hang({ value: Quotes.Burger }).then(
				() => {},
				() => n++,
			)
			return <></>
		}

		const { unmount } = render(
			<ctx.Provider value={t}>
				<C />
			</ctx.Provider>,
		)

		expect(n).toBe(0)
		unmount()

		// `unmount()` will trigger abort event and the promise for response will be rejected.
		// The reject handler will be invoked on next tick, so we yield current tick to observe changes.
		await new Promise(resolve => setTimeout(() => resolve(0), 0))

		expect(n).toBe(1)
	})
})
