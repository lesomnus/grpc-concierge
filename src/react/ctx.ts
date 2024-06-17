import { EventEmitter } from 'events'
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

function createLocalClientSet<C extends ClientConstructorSet>(
	clients: C,
	deps: DependencyMap<C>,
	{
		notifier,
		transport,
		listener,
		isMounted,
		hookedRpcs,
	}: {
		notifier: EventEmitter
		transport: RpcTransport
		listener: () => void
		isMounted: () => boolean
		hookedRpcs: React.MutableRefObject<Map<string, Set<string>>>
	},
): Record<string, RpcClient> {
	const localClients: Record<string, RpcClient> = {}
	const abortController = new AbortController()
	for (const [targetSvcName, Client] of Object.entries(clients)) {
		const interceptors: RpcInterceptor[] = []
		const trackedRpcs = new Set()

		const targetSvcDeps = (deps as DependencyMapDecayed)[targetSvcName]
		if (targetSvcDeps !== undefined) {
			// tracker
			interceptors.push({
				interceptUnary(next, method, input, options) {
					const { localName } = method
					if (!trackedRpcs.has(localName)) {
						trackedRpcs.add(localName)

						const targetRpcDeps = targetSvcDeps[localName] ?? {}

						for (const [
							sourceSvcName,
							sourceRpcNames,
						] of Object.entries(targetRpcDeps)) {
							let hookedRpcNames =
								hookedRpcs.current.get(sourceSvcName)
							if (hookedRpcNames === undefined) {
								hookedRpcNames = new Set<string>()
								hookedRpcs.current.set(
									sourceSvcName,
									hookedRpcNames,
								)
							}

							for (const name of sourceRpcNames) {
								if (hookedRpcNames.has(name)) continue
								hookedRpcNames.add(name)
								notifier.on(
									`${sourceSvcName}.${name}`,
									listener,
								)
							}
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

						notifier.emit(`${targetSvcName}.${method.localName}`)
					})
					.catch(() => {})

				return c
			},
		})

		const localTransport = new TransportProxy(transport, {
			interceptors,
			abort: abortController.signal,
		})
		localClients[targetSvcName] = new Client(localTransport)
	}

	return localClients
}

export function createServiceContext<C extends ClientConstructorSet>(
	clients: C,
	deps: DependencyMap<C> = {},
) {
	const ctx = React.createContext<RpcTransport | null>(null)
	const notifier = new EventEmitter()
	const useService = () => {
		const transport = React.useContext(ctx)
		if (transport === null) {
			throw new Error('')
		}

		const [rendered, render] = React.useReducer(v => v + 1, 0)
		const listener = React.useCallback(() => render(), [])

		const isMounted = hooks.useMountState()
		const hookedRpcs = React.useRef(new Map<string, Set<string>>())

		const isMountingRef = React.useRef(false)
		React.useEffect(() => {
			isMountingRef.current = true
		}, [])

		const createC = React.useCallback(
			() =>
				createLocalClientSet(clients, deps, {
					notifier,
					transport,
					listener,
					isMounted,
					hookedRpcs,
				}),
			[clients, transport, deps, listener, isMounted],
		)

		const c = React.useMemo(() => {
			rendered
			return createC()
		}, [rendered, createC])

		React.useEffect(() => {
			return () => {
				for (const [svcName, rpcName] of hookedRpcs.current) {
					notifier.off(`${svcName}.${rpcName}`, listener)
				}
			}
		}, [listener])

		return c as {
			[K in keyof C]: InstanceType<C[K]>
		}
	}

	return [ctx, useService] as const
}
