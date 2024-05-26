import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useReducer } from 'react'
import { describe, expect, it } from 'vitest'

import * as echo from '~/echo'
import { MockTransport } from '~/index'

import { createServiceContext } from './ctx'

describe('createClient', async () => {
	it('returns RPC client with provided transport', async () => {
		let n = 0
		const t = new MockTransport(new echo.EchoServer(), {
			interceptors: [
				{
					interceptUnary(next, method, input, options) {
						n++
						return next(method, input, options)
					},
				},
			],
		})

		const [ctx, useService] = createServiceContext({
			echo: echo.EchoClient,
		})
		const C: React.FC = () => {
			const s = useService()
			s.echo.hello({ value: '' })
			return <></>
		}

		render(
			<ctx.Provider value={t}>
				<C />
			</ctx.Provider>,
		)

		expect(n).toBe(1)
	})

	it('always returns same value', async () => {
		let n = 0
		const t = new MockTransport(new echo.EchoServer(), {
			interceptors: [
				{
					interceptUnary(next, method, input, options) {
						n++
						return next(method, input, options)
					},
				},
			],
		})

		const [ctx, useService] = createServiceContext({
			echo: echo.EchoClient,
		})
		const C: React.FC = () => {
			const [_, incN] = useReducer(n => n + 1, 0)
			const s = useService()
			React.useEffect(() => {
				s.echo.hello({ value: '' })
			}, [s])
			return (
				<button type="button" onClick={() => incN()}>
					cheese
				</button>
			)
		}

		render(
			<ctx.Provider value={t}>
				<C />
			</ctx.Provider>,
		)

		expect(n).toBe(1)

		// rerender
		await userEvent.click(screen.getByText('cheese'))
		expect(n).toBe(1)
	})

	it('rendered when dependents RPC is invoked', async () => {
		const t = new MockTransport(new echo.EchoServer())

		let n = 0
		const [ctx, useService] = createServiceContext(
			{
				echo1: echo.EchoClient,
				echo2: echo.EchoClient,
			},
			{
				echo1: {
					hello: {
						echo1: ['hola'],
						echo2: ['hello'],
					},
				},
			},
		)
		const C: React.FC = () => {
			const s = useService()
			s.echo1.hello({ value: '' })
			n++
			return (
				<>
					<button
						type="button"
						onClick={() => s.echo1.hola({ value: '' })}>
						echo1.Hola
					</button>
					<button
						type="button"
						onClick={() => s.echo1.konnichiwa({ value: '' })}>
						echo1.Konnichiwa
					</button>
					<button
						type="button"
						onClick={() => s.echo2.hello({ value: '' })}>
						echo2.Hello
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

		// Dependent one.
		await userEvent.click(screen.getByText('echo1.Hola'))
		expect(n).toBe(2)

		// Not a dependent.
		await userEvent.click(screen.getByText('echo1.Konnichiwa'))
		expect(n).toBe(2)

		// Across the client.
		await userEvent.click(screen.getByText('echo2.Hello'))
		expect(n).toBe(3)
	})

	// it('aborts the RPC if the component is unmounted', async () => {
	// 	const t = new MockTransport(new echo.EchoServer())

	// 	let n = 0
	// 	const [ctx, userService] = createServiceContext({
	// 		echo: echo.EchoClient,
	// 	})
	// 	const C: React.FC = () => {
	// 		const s = userService()
	// 		s.echo.hang({ value: '' }).then(
	// 			() => {},
	// 			() => n++,
	// 		)
	// 		return <></>
	// 	}

	// 	const { unmount } = render(
	// 		<ctx.Provider value={t}>
	// 			<C />
	// 		</ctx.Provider>,
	// 	)

	// 	expect(n).toBe(0)
	// 	unmount()

	// 	// `unmount()` will trigger abort event and the promise for response will be rejected.
	// 	// The reject handler will be invoked on next tick, so we yield current tick to observe changes.
	// 	await new Promise(resolve => setTimeout(() => resolve(0), 0))

	// 	expect(n).toBe(1)
	// })
})
