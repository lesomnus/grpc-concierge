import type {
	ClientStreamingCall,
	DuplexStreamingCall,
	MethodInfo,
	ServerStreamingCall,
	UnaryCall,
} from '@protobuf-ts/runtime-rpc'

import type { Message } from './pb/echo'
import type { IEchoClient } from './pb/echo.client'

import { deferUnary, makeUnary } from '~/rpc'

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
