// ===== 專注模式偏好 — localStorage 持久化 =====
//
// What：記住使用者「是否開啟專注模式」這個 UI 偏好。
// Why：專注模式會收掉左側導覽、加油框與重複的文件 Tag，是個人填寫習慣，
//      跨 session 持久化才不會每次打開都要重按。模式只影響版面呈現，
//      不碰任何表單資料，所以獨立成一支輕量 hook（仿 useLLMSettings 寫法）。

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'forminator-focus-mode';

// 讀偏好：localStorage 存的是字串 'true'/'false'，失敗或沒存過一律回 false（預設關閉）
function loadFocusMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useFocusMode() {
  // lazy init：第一次 render 才讀 localStorage，避免每次 render 都碰 storage
  const [focusMode, setFocusMode] = useState<boolean>(loadFocusMode);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* localStorage 不可用時只在記憶體切換，不阻斷操作 */
      }
      return next;
    });
  }, []);

  return { focusMode, toggleFocusMode };
}
