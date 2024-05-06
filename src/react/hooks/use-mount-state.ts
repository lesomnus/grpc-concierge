import { useCallback, useEffect, useRef } from 'react'

export function useMountState() {
	const ref = useRef(true)
	useEffect(() => {
		ref.current = true
		return () => {
			ref.current = false
		}
	}, [])
	return useCallback(() => ref.current, [])
}
