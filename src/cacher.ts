import type {
	MethodInfo,
	NextUnaryFn,
	RpcInterceptor,
	RpcOptions,
	UnaryCall,
} from '@protobuf-ts/runtime-rpc'

import { makeUnary } from './rpc'
import type { RpcClient, UnaryInputOf, UnaryOutputOf } from './types'

class Cache<T> {
	constructor(public value?: T) {}
}

type CacheResolver<T extends UnaryCall = UnaryCall> = (
	input: UnaryInputOf<T>,
	options: RpcOptions,
) => Cache<UnaryOutputOf<T>>

type CacheResolverMapping<C extends RpcClient> = {
	[K in keyof C]?: CacheResolver<ReturnType<C[K]>>
}

type CacheUtils<C extends RpcClient> = {
	byKey: <T, K extends keyof C>(
		keyer: (
			input: UnaryInputOf<ReturnType<C[K]>>,
			options: RpcOptions,
		) => T | undefined,
	) => CacheResolver<ReturnType<C[K]>> | undefined
}

function makeUtils<C extends RpcClient>(): CacheUtils<C> {
	return {
		byKey(keyer) {
			const vs = new Map()
			return (input, options) => {
				const k = keyer(input, options)
				if (k === undefined) {
					return undefined
				}

				let v = vs.get(k)
				if (v === undefined) {
					v = new Cache()
					vs.set(k, v)
				}

				return v
			}
		},
	}
}

export class Cacher<C extends RpcClient> implements RpcInterceptor {
	#resolvers: CacheResolverMapping<C> = {}

	constructor(getResolvers: (u: CacheUtils<C>) => CacheResolverMapping<C>) {
		this.#resolvers = getResolvers(makeUtils<C>())
	}

	interceptUnary(
		next: NextUnaryFn,
		method: MethodInfo,
		input: object,
		options: RpcOptions,
	): UnaryCall<object, object> {
		const cache = (
			this.#resolvers[method.localName] as CacheResolver | undefined
		)?.(input, options)
		if (cache?.value !== undefined) {
			return makeUnary(cache.value, {
				method,
				input,
				headers: { status: '304' },
			})
		}

		const call = next(method, input, options)
		if (cache !== undefined) {
			call.then(({ response }) => {
				cache.value = response
			})
		}
		return call
	}
}
