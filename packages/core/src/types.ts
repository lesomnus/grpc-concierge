import { RpcOptions, UnaryCall } from '@protobuf-ts/runtime-rpc'

export type Maybe<T> = T | undefined

export type UnaryFn<I extends object = object, O extends object = object> = (
	input: I,
	options?: RpcOptions,
) => UnaryCall<I, O>

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type RpcClient = Record<string, any>

export type UnaryInputOf<T> = T extends UnaryCall<infer I, infer O> ? I : never
export type UnaryOutputOf<T> = T extends UnaryCall<infer I, infer O> ? O : never
