import type { RpcInterceptor, RpcTransport } from '@protobuf-ts/runtime-rpc'
import React from 'react'

import type { RpcClient, UnaryFn } from '~/index'
import { TransportProxy } from '~/index'

import * as hooks from './hooks'

// Extract unary functions from RpcClient.
type UnaryOnly<C extends RpcClient> = {
	[K in keyof C as C[K] extends UnaryFn<infer I, infer O> ? K : never]: C[K]
}

type RpcClientConstructor<C extends RpcClient = RpcClient> = new (
	transport: RpcTransport,
) => C

type ClientConstructorSet = Record<string, RpcClientConstructor>

type DependencyMap<C extends ClientConstructorSet> = {
	[Kx in keyof C]?: {
		[Mx in keyof UnaryOnly<InstanceType<C[Kx]>>]?: {
			[Ky in keyof C]?: Ky extends Kx
				? Exclude<keyof UnaryOnly<InstanceType<C[Ky]>>, Mx>[]
				: (keyof UnaryOnly<InstanceType<C[Ky]>>)[]
		}
	}
}

type DependencyMapDecayed = {
	[k: string]: {
		[k: string]: {
			[k: string]: string[]
		}
	}
}

export function createServiceContext<C extends ClientConstructorSet>(
	clients: C,
	deps: DependencyMap<C> = {},
) {
	const ctx = React.createContext<RpcTransport | null>(null)
	const useService = () => {
		const v = React.useContext(ctx)
		if (v === null) {
			throw new Error('')
		}

		const interceptedClientsRef = React.useRef<Record<
			string,
			RpcClient
		> | null>(null)

		const render = hooks.useRender()
		const isMounted = hooks.useMountState()
		const hookedRpcs = React.useRef(new Map<string, Set<string>>())
		const abortController = React.useRef(new AbortController())
		if (interceptedClientsRef.current === null) {
			interceptedClientsRef.current = {}
			for (const [targetSvcName, Client] of Object.entries(clients)) {
				const interceptors: RpcInterceptor[] = []

				const targetSvcDeps = (deps as DependencyMapDecayed)[
					targetSvcName
				]
				if (targetSvcDeps !== undefined) {
					// tracker
					interceptors.push({
						interceptUnary(next, method, input, options) {
							// TODO: skip if hook already made.
							const targetRpcDeps =
								targetSvcDeps[method.localName] ?? {}

							for (const [
								sourceSvcName,
								sourceRpcNames,
							] of Object.entries(targetRpcDeps)) {
								const sourceHookedRpcNames =
									hookedRpcs.current.get(sourceSvcName) ??
									new Set<string>()

								hookedRpcs.current.set(
									sourceSvcName,
									sourceHookedRpcNames,
								)

								for (const name of sourceRpcNames) {
									sourceHookedRpcNames.add(name)
								}
							}

							return next(method, input, options)
						},
					})
				}

				// trigger
				interceptors.push({
					interceptUnary(next, method, input, options) {
						const c = next(method, input, options)
						c.headers
							.then(h => {
								if (!isMounted()) {
									return
								}
								if (h.status === '304') {
									// Does not trigger in the case of cache response.
									return
								}

								const hookedRpcNames =
									hookedRpcs.current.get(targetSvcName)
								if (
									hookedRpcNames?.has(method.localName) !==
									true
								) {
									return
								}

								interceptedClientsRef.current = {
									...interceptedClientsRef.current,
								}
								render()
							})
							.catch(() => {})

						return c
					},
				})

				const transport = new TransportProxy(v, {
					interceptors,
					abort: abortController.current.signal,
				})
				interceptedClientsRef.current[targetSvcName] = new Client(
					transport,
				)
			}
		}

		// React.useEffect(
		// 	() => () => {
		// 		abortController.current.abort()
		// 	},
		// 	[],
		// )

		return interceptedClientsRef.current as {
			[K in keyof C]: InstanceType<C[K]>
		}
	}

	return [ctx, useService] as const
}
