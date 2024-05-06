import type {
	MethodInfo,
	NextUnaryFn,
	RpcInterceptor,
	RpcOptions,
} from '@protobuf-ts/runtime-rpc'
import { UnaryCall } from '@protobuf-ts/runtime-rpc'

import { deferUnary } from './rpc'
import type { RpcClient, UnaryInputOf } from './types'

const neverAbort = new AbortController()

type PromiseWithOrigin<P extends PromiseLike<T>, T> = Promise<T> & { origin: P }

function promiseWithOrigin<P extends PromiseLike<T>, T>(
	origin: P,
	executor?: (
		resolve: (value: T | PromiseLike<T>) => void,
		reject: (reason?: unknown) => void,
	) => void,
): PromiseWithOrigin<P, T> {
	const p = new Promise<T>((resolve, reject) => {
		origin.then(
			v => resolve(v),
			e => reject(e),
		)
		executor?.(
			v => resolve(v),
			e => reject(e),
		)
	})

	return Object.assign(p, { origin })
}

type Ctx<P extends PromiseLike<unknown>> = {
	n: Set<AbortSignal>
	c: AbortController
	w: P
}

export class Hitch<P extends PromiseLike<T>, T = Awaited<P>> {
	#ctx: Ctx<P> | undefined = undefined

	private static concrete<P extends PromiseLike<T>, T>(ctx: Ctx<P>) {
		ctx.n.add(neverAbort.signal)
		return promiseWithOrigin<P, T>(ctx.w)
	}

	private static flexible<P extends PromiseLike<T>, T>(
		ctx: Ctx<P>,
		signal: AbortSignal,
	) {
		ctx.n.add(signal)
		return promiseWithOrigin<P, T>(ctx.w, (resolve, reject) => {
			signal.addEventListener('abort', () => {
				ctx.n.delete(signal)
				switch (ctx.n.size) {
					case 0: {
						// `signal` is aborted after `ctx.w` is aborted.
						// The rejection callback already been invoked so it is ignored.
						break
					}

					case 1: {
						// This was the last hanging signal, which means that there are no waiters for the work.
						// Therefore, abort the work.
						// Note that `ctx.n.size` is 1 because there is `ctx.c`.
						ctx.n.clear()
						ctx.c.abort(signal.reason)

						// It is needed to reject explicitly since the original work
						// may not respect the signal.
						reject(signal.reason)
						return
					}

					default: {
						reject(signal.reason)
						break
					}
				}
			})
		})
	}

	do(
		f: (signal: AbortSignal) => P,
		signal?: AbortSignal,
	): PromiseWithOrigin<P, T> {
		if (signal?.aborted) {
			throw signal.reason
		}

		if (this.#ctx === undefined) {
			const c = new AbortController()
			const w = f(c.signal)
			const ctx = { n: new Set([c.signal]), c, w } as Ctx<P>

			const reset = () => {
				ctx.n.clear()
				this.#ctx = undefined
			}

			w.then(reset, reset)
			this.#ctx = ctx
		}

		return signal === undefined
			? Hitch.concrete(this.#ctx)
			: Hitch.flexible(this.#ctx, signal)
	}
}

type HitchResolver<T extends UnaryCall = UnaryCall> = (
	input: UnaryInputOf<T>,
	options: RpcOptions,
) => Hitch<UnaryCall> | undefined

type HitchResolverMapping<C extends RpcClient> = {
	[K in keyof C]?: HitchResolver<ReturnType<C[K]>>
}

type HitchUtils<C extends RpcClient> = {
	// Hitch all requests.
	all: <K extends keyof C>() => HitchResolver<ReturnType<C[K]>>

	// Hitch requests with the same key.
	byKey: <T, K extends keyof C>(
		keyer: (
			input: UnaryInputOf<ReturnType<C[K]>>,
			options: RpcOptions,
		) => T | undefined,
	) => HitchResolver<ReturnType<C[K]>>
}

function makeUtils<C extends RpcClient>(): HitchUtils<C> {
	return {
		all() {
			const v = new Hitch<UnaryCall>()
			return () => v
		},
		byKey(keyer) {
			const vs = new Map<ReturnType<typeof keyer>, Hitch<UnaryCall>>()
			return (input, options) => {
				const k = keyer(input, options)
				if (k === undefined) {
					return undefined
				}

				let v = vs.get(k)
				if (v === undefined) {
					v = new Hitch<UnaryCall>()
					vs.set(k, v)
				}

				return v
			}
		},
	}
}

export class Hitchhiker<C extends RpcClient> implements RpcInterceptor {
	#resolvers: HitchResolverMapping<C> = {}

	constructor(getResolvers: (u: HitchUtils<C>) => HitchResolverMapping<C>) {
		this.#resolvers = getResolvers(makeUtils<C>())
	}

	interceptUnary(
		next: NextUnaryFn,
		method: MethodInfo,
		input: object,
		options: RpcOptions,
	): UnaryCall {
		const hitch = (
			this.#resolvers[method.localName] as HitchResolver | undefined
		)?.(input, options)
		if (hitch === undefined) {
			return next(method, input, options)
		}

		const { abort, ...rest } = options
		const w = hitch.do(
			abort => next(method, input, { ...rest, abort }),
			abort,
		)

		const [deferred, resolve, reject] = deferUnary(method, input, options)
		w.then(res =>
			resolve(
				new UnaryCall(
					w.origin.method,
					w.origin.requestHeaders,
					w.origin.request,
					Promise.resolve(res.headers),
					Promise.resolve(res.response),
					Promise.resolve(res.status),
					Promise.resolve(res.trailers),
				),
			),
		).catch(reason => reject(reason))

		return deferred
	}
}
