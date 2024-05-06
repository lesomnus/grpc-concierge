# gcpc-concierge

gRPC transport on top of [`timostamm/protobuf-ts`](https://github.com/timostamm/protobuf-ts) that helps you to cache, deduplicate, and abort the request.

## Usage

> Currently only unary call is supported.

### Cache and Deduplication

```ts
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport'
import { Cacher, Hitchhiker } from 'grpc-concierge'

import { IEchoClient } from './pb/echo.client'

const transport = new GrpcWebFetchTransport({
	baseUrl: 'https://example.com',
	interceptors: [
		new Cacher<IEchoClient>(({ byKey })=>({
			// Cached value will be returned if `msg.value` is same.
			hello: byKey(msg => msg.value)
		})),
		new Hitchhiker<IEchoClient>(({ byKey }) => ({
			// Request that has the same `msg.value` are processed as a single request.
			hello: byKey(msg => msg.value)
		})),
	],
})
```

### React Hook

- Re-rendering the component when the dependent RPC succeeds.
- Abort RPCs used when the component unmounted.

```tsx
import { createServiceContext } from 'grpc-concierge/react'

import { EchoClient } from './pb/echo.client'

const [ctx, useService] = createServiceContext({
	echo: EchoClient
}, {
	// `echo.hello` depends on `echo.hola`.
	echo: {
		hello: {
			echo: ['hola']
		}
	}
})

// This component rerendered whenever `svc.echo.hola` succeeds.
function EchoComponent(){
	const svc = useService()
	svc.echo.hello()
	return <>...</>
}
```

You can see more examples at test.
- [`core/Cacher`](/src/cacher.test.ts) - caches the responses.
- [`core/Hitchhiker`](/src/hitchhiker.test.ts) - deduplicates the requests.
- [`react/createServiceContext`](/src/react/ctx.test.tsx) - manages client life cycle.
