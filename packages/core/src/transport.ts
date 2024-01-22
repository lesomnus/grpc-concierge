import {
	ClientStreamingCall,
	DuplexStreamingCall,
	MethodInfo,
	RpcError,
	RpcOptions,
	RpcTransport,
	ServerStreamingCall,
	UnaryCall,
	mergeRpcOptions,
} from '@protobuf-ts/runtime-rpc'

import { RpcClient, UnaryFn } from './types'
import { Status } from './status'
import { deferUnary, makeUnary } from './rpc'

export class TransportProxy implements RpcTransport {
	constructor(
		public target: RpcTransport,
		public options?: RpcOptions,
	) {}

	mergeOptions(options?: Partial<RpcOptions> | undefined): RpcOptions {
		return this.target.mergeOptions(
			mergeRpcOptions(this.options ?? {}, options),
		)
	}

	unary<I extends object, O extends object>(
		method: MethodInfo<I, O>,
		input: I,
		options: RpcOptions,
	): UnaryCall<I, O> {
		return this.target.unary(method, input, options)
	}

	serverStreaming<I extends object, O extends object>(
		method: MethodInfo<I, O>,
		input: I,
		options: RpcOptions,
	): ServerStreamingCall<I, O> {
		return this.target.serverStreaming(method, input, options)
	}

	clientStreaming<I extends object, O extends object>(
		method: MethodInfo<I, O>,
		options: RpcOptions,
	): ClientStreamingCall<I, O> {
		return this.target.clientStreaming(method, options)
	}

	duplex<I extends object, O extends object>(
		method: MethodInfo<I, O>,
		options: RpcOptions,
	): DuplexStreamingCall<I, O> {
		return this.target.duplex(method, options)
	}
}

export class MockTransport implements RpcTransport {
	constructor(
		public target: RpcClient,
		public options?: RpcOptions,
	) {}

	mergeOptions(options?: Partial<RpcOptions> | undefined): RpcOptions {
		return mergeRpcOptions(this.options ?? {}, options)
	}

	#getUnary<I extends object, O extends object>(
		method: MethodInfo<I, O>,
	): UnaryFn<I, O> {
		const f = this.target[method.localName] as unknown
		if (typeof f === 'function') {
			return f as UnaryFn<I, O>
		}

		return (): UnaryCall<I, O> => {
			throw new RpcError(
				'method not implemented',
				Status.msg.UNIMPLEMENTED,
			)
		}
	}

	unary<I extends object, O extends object>(
		method: MethodInfo<I, O>,
		input: I,
		options: RpcOptions,
	): UnaryCall<I, O> {
		let c: UnaryCall<I, O>
		try {
			c = this.#getUnary(method).apply(this.target, [input, options])
		} catch (e) {
			// `makeUnary` will handle `e`.
			c = makeUnary(Promise.reject(e), { input })
		}

		const [deferred, resolve, reject] = deferUnary(method, input, options)
		const { abort } = options
		abort?.addEventListener('abort', () => reject(abort.reason))
		c.then(() => resolve(c)).catch(reason => reject(reason))

		return deferred
	}

	serverStreaming<I extends object, O extends object>(
		method: MethodInfo<I, O>,
		input: I,
		options: RpcOptions,
	): ServerStreamingCall<I, O> {
		throw new Error('Method not implemented.')
	}

	clientStreaming<I extends object, O extends object>(
		method: MethodInfo<I, O>,
		options: RpcOptions,
	): ClientStreamingCall<I, O> {
		throw new Error('Method not implemented.')
	}

	duplex<I extends object, O extends object>(
		method: MethodInfo<I, O>,
		options: RpcOptions,
	): DuplexStreamingCall<I, O> {
		throw new Error('Method not implemented.')
	}
}
