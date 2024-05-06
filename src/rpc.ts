import type {
	MethodInfo,
	RpcMetadata,
	RpcOptions,
	RpcStatus,
} from '@protobuf-ts/runtime-rpc'
import { Deferred, RpcError, UnaryCall } from '@protobuf-ts/runtime-rpc'

import Codes from './codes'

type Meta<I extends object = object, O extends object = object> = {
	method?: MethodInfo<I, O>
	input?: I
	headers?: RpcMetadata
	trailers?: RpcMetadata
}

export function makeUnary<O extends object = object, I extends object = object>(
	res: O | Promise<O>,
	{ method, input, headers, trailers }: Meta<I, O> = {},
) {
	let r = 'then' in res ? res : Promise.resolve(res)
	r = r
		.then(v => structuredClone(v))
		.catch((e: unknown) => {
			if (e instanceof RpcError) {
				return Promise.reject(e)
			}

			let message = 'internal server error'
			if (e instanceof Error) {
				message = `${message}: ${e.message}`
			}

			const err = new RpcError(message, Codes.INTERNAL)
			return Promise.reject(err)
		})

	return new UnaryCall<I, O>(
		method ?? ({} as MethodInfo<I, O>),
		{},
		input ?? ({} as I),
		r.then(() => headers ?? {}),
		r,
		r.then(() => ({ code: Codes.OK, detail: '' })),
		r.then(() => trailers ?? {}),
	)
}

export function deferUnary<I extends object, O extends object>(
	method: MethodInfo<I, O>,
	input: I,
	options?: RpcOptions,
): [
	UnaryCall<I, O>,
	(result: UnaryCall<I, O>) => void,
	(error: unknown) => void,
] {
	const deferredHeaders = new Deferred<RpcMetadata>()
	const deferredResponse = new Deferred<O>()
	const deferredStatus = new Deferred<RpcStatus>()
	const deferredTrailer = new Deferred<RpcMetadata>()

	let isSettled = false
	const settle = () => {
		if (isSettled) {
			return false
		}

		isSettled = true
		return true
	}

	return [
		new UnaryCall<I, O>(
			method,
			options?.meta ?? {},
			input,
			deferredHeaders.promise,
			deferredResponse.promise,
			deferredStatus.promise,
			deferredTrailer.promise,
		),
		({ headers, response, status, trailers }) => {
			if (!settle()) return
			deferredHeaders.resolve(headers)
			deferredResponse.resolve(response)
			deferredStatus.resolve(status)
			deferredTrailer.resolve(trailers)
		},
		(error: unknown) => {
			if (!settle()) return
			deferredHeaders.rejectPending(error)
			deferredResponse.rejectPending(error)
			deferredStatus.rejectPending(error)
			deferredTrailer.rejectPending(error)
		},
	]
}
