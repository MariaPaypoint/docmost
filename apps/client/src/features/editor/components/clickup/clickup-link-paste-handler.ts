import { Editor } from '@tiptap/core';
import { ClickUpTaskManager } from './use-clickup-task';

/**
 * Handler for processing pasted ClickUp links
 * Detects ClickUp URLs in pasted content and processes them
 * into enhanced link display
 */
const handleClickUpLinkPaste = (editor: Editor) => {
  // Get the ProseMirror DOM Element
  const domElement = editor.view.dom;
  
  // Handler function for paste events
  const pasteHandler = async (event: ClipboardEvent) => {
    // Get pasted text from clipboard
    const clipboardText = event.clipboardData?.getData('text/plain');
    
    if (!clipboardText) return;
    
    // Check if this is a ClickUp link
    const taskId = ClickUpTaskManager.extractTaskId(clipboardText);
    if (!taskId) {
      return false;
    }
    
    // Important: prevent default paste behavior if it's a ClickUp URL
    // This stops the default paste handling completely
    event.preventDefault();
    event.stopPropagation();
    
    // We need to focus the editor to ensure the content is inserted at cursor position
    editor.view.focus();
    
    // Insert the link with proper attributes
    editor.commands.insertContent({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: clipboardText,
        marks: [
          {
            type: 'link',
            attrs: {
              href: clipboardText,
              target: '_blank',
              rel: 'noopener noreferrer',
              class: 'clickup-link'
            }
          }
        ]
      }]
    });
    
    // Try to fetch task data to enhance the link
    try {
      // Find the link node we just inserted and update its attributes
      const { state } = editor.view;
      const { doc } = state;
      let linkPos: number | null = null;
      
      doc.descendants((node, pos) => {
        if (node.type.name === 'link' && node.attrs.href === clipboardText) {
          linkPos = pos;
          return false;
        }
        return true;
      });
      
      // Only fetch task data if we found the link position
      // This avoids unnecessary API calls when the link can't be found
      if (linkPos !== null) {
        const taskData = await ClickUpTaskManager.getTask(taskId);
        
        // Update the link with task data
        editor.view.dispatch(
          editor.view.state.tr.setNodeMarkup(
            linkPos,
            undefined,
            {
              ...doc.nodeAt(linkPos)?.attrs,
              taskId: taskId,
              taskName: taskData?.name,
              taskStatusColor: taskData?.status?.color,
            }
          )
        );
      }
    } catch (error) {
      console.error('Failed to fetch ClickUp task data:', error);
    }
  };
  
  // Add event listener with capture phase to intercept paste before editor handlers
  domElement.addEventListener('paste', pasteHandler, { capture: true });
  
  // Return cleanup function
  return () => {
    domElement.removeEventListener('paste', pasteHandler, { capture: true });
  };
};

// Make sure default export matches named export
export default handleClickUpLinkPaste;
