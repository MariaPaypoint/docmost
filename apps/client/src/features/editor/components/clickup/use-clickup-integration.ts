import { useEffect } from 'react';
import { Editor } from '@tiptap/core';
import handleClickUpLinkPaste from './clickup-link-paste-handler';
import './clickup-styles.css'; // Импорт стилей для ClickUp интеграции

/**
 * Hook for setting up ClickUp integration features
 * This sets up paste handlers and other integrations for ClickUp
 */
export const useClickUpIntegration = (editor: Editor | null) => {
  useEffect(() => {
    if (!editor) {
      return;
    }

    // Set up paste handler for ClickUp links directly
    const removeHandler = handleClickUpLinkPaste(editor);
    
    // Return cleanup function
    return () => {
      if (typeof removeHandler === 'function') {
        removeHandler();
      }
    };
  }, [editor]);
};

export default useClickUpIntegration;
