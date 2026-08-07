import { useEffect } from 'react';
import { useUpdateNodeInternals } from '@xyflow/react';
import { useLayoutDir } from './LayoutContext';

export function useLayoutUpdate(id: string) {
  const layoutDir = useLayoutDir();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    // Notify React Flow that handles have changed position
    updateNodeInternals(id);
  }, [layoutDir, id, updateNodeInternals]);

  return layoutDir;
}
