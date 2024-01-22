const c = [
	"OK",
	"CANCELLED",
	"UNKNOWN",
	"INVALID_ARGUMENT",
	"DEADLINE_EXCEEDED",
	"NOT_FOUND",
	"ALREADY_EXISTS",
	"PERMISSION_DENIED",
	"RESOURCE_EXHAUSTED",
	"FAILED_PRECONDITION",
	"ABORTED",
	"OUT_OF_RANGE",
	"UNIMPLEMENTED",
	"INTERNAL",
	"UNAVAILABLE",
	"DATA_LOSS",
	"UNAUTHENTICATED",
] as const;

const msg = c.reduce(
	(o, v) => {
		o[v] = v;
		return o;
	},
	{} as Record<string, string>,
) as {
	[K in (typeof c)[number]]: K;
};

const code = c.reduce(
	(o, v, i) => {
		o[v] = i;
		return o;
	},
	{} as Record<string, number>,
) as {
	[K in (typeof c)[number]]: number;
};

export const Status = {
	msg,
	code,
};
