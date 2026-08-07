import { createContext, useContext } from 'react';

export const LayoutContext = createContext<'horizontal' | 'vertical'>('horizontal');

export const useLayoutDir = () => useContext(LayoutContext);
