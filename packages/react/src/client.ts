import { RpcInterceptor, RpcTransport } from '@protobuf-ts/runtime-rpc'
import React, { MutableRefObject } from 'react'
import { EventEmitter } from 'events'

import { RpcClient, TransportProxy, UnaryFn } from 'grpc-concierge'
import { EchoClient } from '@test/echo'

const nil = {}

// Extract unary functions from RpcClient.
type S<C extends RpcClient> = {
	[K in keyof C as C[K] extends UnaryFn<infer I, infer O> ? K : never]: C[K]
}

type DependencyMap<C extends RpcClient> = {
	[K in keyof S<C>]?: Exclude<keyof S<C>, K>[]
}

type A = DependencyMap<EchoClient>

export function createClientHook<C extends RpcClient>(
	Client: new (transport: RpcTransport) => C,
	deps: DependencyMap<C> = {},
) {
	const dependents = Object.entries(deps as Record<string, string[]>).reduce<{
		[k: string]: Set<string> | undefined
	}>((rst, [k, deps]) => {
		if (deps === undefined) {
			return rst
		}
		for (const dep of deps) {
			let vs = rst[dep]
			if (vs === undefined) {
				vs = rst[dep] = new Set()
			}

			vs.add(k)
		}

		return rst
	}, {})

	const evt = new EventEmitter()
	const ctx = React.createContext(nil as RpcTransport)

	const useClient = (): C => {
		const v = React.useContext(ctx)
		if (v === nil) {
			throw new Error('transport not provided')
		}

		const [_, render] = React.useReducer(x => x + 1, 0)
		const rpcsInUse = React.useRef(new Set<string>())
		const abortController = React.useRef(new AbortController())
		const c = React.useRef<C>(null) as MutableRefObject<C>
		if (c.current === null) {
			c.current = (() => {
				const tracker: RpcInterceptor = {
					interceptUnary(next, method, input, options) {
						const name = method.localName
						if (!rpcsInUse.current.has(name)) {
							rpcsInUse.current.add(name)
							evt.on(name, render)
						}
						return next(method, input, options)
					},
				}
				const propagator: RpcInterceptor = {
					interceptUnary(next, method, input, options) {
						const c = next(method, input, options)
						c.headers
							.then(h => {
								if (h.status === '304') {
									// Does not propagate in the case of cache response.
									return
								}

								const vs = dependents[method.localName]
								if (!vs) {
									return
								}

								for (const v of vs.values()) {
									evt.emit(v)
								}
							})
							.catch(() => {})

						return c
					},
				}

				const transport = new TransportProxy(v, {
					interceptors: [tracker, propagator],
					abort: abortController.current.signal,
				})

				return new Client(transport)
			})()
		}

		React.useEffect(() => () => {
			for (const name of rpcsInUse.current.values()) {
				evt.off(name, render)
			}
		})
		React.useEffect(
			() => () => {
				abortController.current.abort()
			},
			[],
		)

		return c.current
	}

	return [ctx, useClient] as const
}
