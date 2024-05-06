import { useReducer } from 'react'

export function useRender() {
	const [, render] = useReducer(v => v + 1, 0)
	return render
}
