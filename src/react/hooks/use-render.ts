import { useReducer } from 'react'

export function useRender() {
	return useReducer(v => v + 1, 0)
}
