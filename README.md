# gcpc-concierge

gRPC transport on top of [`timostamm/protobuf-ts`](https://github.com/timostamm/protobuf-ts) that helps you to cache, deduplicate, and abort the request.

## Usage

> Currently only unary call is supported.

```ts
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport'
import { Cacher, Hitchhiker } from 'grpc-concierge'

import { IEchiClient } from './pb/echo.client'

const transport = new GrpcWebFetchTransport({
	baseUrl: 'https://example.com',
	interceptors: [
		new Cacher<IEchiClient>(({ byKey })=>({
			// Cached value will be returned if `msg.value` is same.
			hello: byKey(msg => msg.value)
		})),
		new Hitchhiker<IEchiClient>(({ byKey }) => ({
			// Request that has the same `msg.value` are processed as a single request.
			hello: byKey(msg => msg.value)
		})),
	],
})
```

You can see more examples at test.
- [`core/Cacher`](/packages/core/src/cacher.test.ts) - caches the responses.
- [`core/Hitchhiker`](/packages/core/src/hitchhiker.test.ts) - deduplicates the requests.
- [`react/createClientHook`](/packages/react/src//client.test.tsx) - manages client life cycle.
