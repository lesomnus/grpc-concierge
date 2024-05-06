const Codes = (() => {
	const c = [
		'OK',
		'CANCELLED',
		'UNKNOWN',
		'INVALID_ARGUMENT',
		'DEADLINE_EXCEEDED',
		'NOT_FOUND',
		'ALREADY_EXISTS',
		'PERMISSION_DENIED',
		'RESOURCE_EXHAUSTED',
		'FAILED_PRECONDITION',
		'ABORTED',
		'OUT_OF_RANGE',
		'UNIMPLEMENTED',
		'INTERNAL',
		'UNAVAILABLE',
		'DATA_LOSS',
		'UNAUTHENTICATED',
	] as const

	return c.reduce(
		(o, v) => {
			o[v] = v
			return o
		},
		{} as Record<string, string>,
	) as {
		[K in (typeof c)[number]]: K
	}
})()

export default Codes
