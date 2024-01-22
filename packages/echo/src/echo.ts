import {
	UnaryCall,
	ServerStreamingCall,
	ClientStreamingCall,
	DuplexStreamingCall,
	MethodInfo,
	RpcOptions,
} from '@protobuf-ts/runtime-rpc'

import { Message } from './pb/echo'
import { IEchoClient } from './pb/echo.client'

import { makeUnary, deferUnary } from '../../core/src/rpc'

export class EchoServer implements IEchoClient {
	hello(input: Message): UnaryCall<Message, Message> {
		return makeUnary(input, { input })
	}

	hola(input: Message): UnaryCall<Message, Message> {
		return this.hello(input)
	}

	konnichiwa(input: Message): UnaryCall<Message, Message> {
		return this.hello(input)
	}

	hang(input: Message): UnaryCall<Message, Message> {
		const [deferred] = deferUnary({} as MethodInfo, input)
		return deferred
	}

	divide(input: Message): ServerStreamingCall<Message, Message> {
		throw new Error('Method not implemented.')
	}

	concat(): ClientStreamingCall<Message, Message> {
		throw new Error('Method not implemented.')
	}

	batch(): DuplexStreamingCall<Message, Message> {
		throw new Error('Method not implemented.')
	}
}
