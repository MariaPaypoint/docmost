import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { ClickUpTaskManager } from './use-clickup-task';

/**
 * Extension to detect and render ClickUp links with task status and name
 */
export const ClickUpLinkExtension = Extension.create({
  name: 'clickupLink',

  addOptions() {
    return {
      // Add any options here if needed
    };
  },

  addKeyboardShortcuts() {
    return {
      // Handle Backspace to delete ClickUp links
      Backspace: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        
        // Only handle when we have a cursor selection
        if (!selection.empty) {
          return false;
        }
        
        // Check if cursor is positioned just after a link
        const $pos = selection.$head;
        const nodeBefore = $pos.nodeBefore;
        
        // If we have a node before cursor and it's a text node
        if (nodeBefore && nodeBefore.isText) {
          // Check if this node has link marks
          const clickUpLinkMark = nodeBefore.marks.find(mark => {
            if (mark.type.name === 'link') {
              const href = mark.attrs.href || '';
              return href.includes('app.clickup.com/t/');
            }
            return false;
          });
          
          if (clickUpLinkMark) {
            // We found a ClickUp link, delete it completely
            const from = $pos.pos - nodeBefore.nodeSize;
            const to = $pos.pos;
            
            console.log('Deleting ClickUp link:', from, to);
            
            // Create a new transaction
            const tr = state.tr.delete(from, to);
            view.dispatch(tr);
            return true;
          }
        }
        
        return false;
      }
    };
  },

  addProseMirrorPlugins() {
    const clickUpURLRegex = /https:\/\/app\.clickup\.com\/t\/([a-z0-9]+)/i;
    // Cache for task data to avoid redundant API calls
    const taskCache: Record<string, any> = {};

    return [
      new Plugin({
        key: new PluginKey('clickupLink'),
        
        // Use decorations to render ClickUp links
        props: {
          // Create decorations for ClickUp links
          decorations: (state) => {
            const { doc } = state;
            const decorations: Decoration[] = [];
            
            // Find all link nodes
            doc.descendants((node: ProseMirrorNode, pos: number) => {
              // Check if this node has a link mark
              const linkMark = node.marks.find(mark => mark.type.name === 'link');
              
              if (linkMark) {
                const url = linkMark.attrs.href || '';
                const taskId = ClickUpTaskManager.extractTaskId(url);
                
                // If this is a ClickUp link
                if (taskId) {
                  // Add decoration with custom rendering
                  const from = pos;
                  const to = pos + node.nodeSize;

                  // Generate the HTML for our custom ClickUp link display
                  const generateClickUpLinkHtml = (taskData: any) => {
                    const taskName = taskData?.name || 'Задача ClickUp';
                    const statusColor = taskData?.status?.color || '#ddd';
                    
                    return `
                      <span class="clickup-link-container">
                        <span class="clickup-task-status" style="background-color: ${statusColor}"></span>
                        <span class="clickup-task-name">${taskName}</span>
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="clickup-external-link">
                          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                            <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                            <path d="M11 13l9 -9" />
                            <path d="M15 4h5v5" />
                          </svg>
                        </a>
                      </span>
                    `;
                  };

                  // Check if we have task data in cache
                  if (taskCache[taskId]) {
                    // Create decoration with cached data
                    decorations.push(
                      Decoration.widget(from, () => {
                        const span = document.createElement('span');
                        span.className = 'clickup-link-widget';
                        span.innerHTML = generateClickUpLinkHtml(taskCache[taskId]);
                        span.addEventListener('click', (e) => {
                          // Handle click on external link icon
                          const target = e.target as HTMLElement;
                          if (target && (target.closest('.clickup-external-link') || target.className === 'clickup-external-link')) {
                            // Do nothing, let the link work
                          } else {
                            // Prevent default click behavior for the rest of the widget
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        });
                        return span;
                      })
                    );
                    
                    // Hide the original link text
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'clickup-link-hidden',
                      })
                    );
                  } else {
                    // We don't have data yet, show loading state and fetch data
                    decorations.push(
                      Decoration.widget(from, () => {
                        const span = document.createElement('span');
                        span.className = 'clickup-link-widget clickup-link-loading';
                        span.innerHTML = `
                          <span class="clickup-link-container">
                            <span class="clickup-task-status" style="background-color: #ddd"></span>
                            <span class="clickup-task-name">Loading task...</span>
                          </span>
                        `;
                        return span;
                      })
                    );
                    
                    // Hide the original link text
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'clickup-link-hidden',
                      })
                    );
                    // Fetch task data using centralized manager
                    ClickUpTaskManager.getTask(taskId)
                      .then(taskData => {
                        // Store in local cache for fast rendering
                        taskCache[taskId] = taskData;
                        
                        // Force re-render decorations
                        this.editor?.view.dispatch(this.editor.state.tr);
                      })
                      .catch(error => {
                        console.error('[ClickUpExt] Error fetching task:', error);
                      });
                  }
                }
              }
              
              return true;
            });
            
            return DecorationSet.create(doc, decorations);
          },
          
          // Handle clicks on ClickUp links
          handleClick: (view, pos, event) => {
            // Check if we clicked inside our custom widget
            const target = event.target as HTMLElement;
            if (target && target.closest('.clickup-link-widget')) {
              // Let external link clicks through
              if (target.closest('.clickup-external-link')) {
                return false; // Don't prevent default for external link
              }
              return true; // Prevent default link behavior for the rest
            }
            return false;
          },
          
          // Handle keyboard events to allow deleting ClickUp links with Backspace
          handleKeyDown: (view, event) => {
            // Only handle Backspace key
            if (event.key !== 'Backspace') {
              return false;
            }
            
            const { state, dispatch } = view;
            const { selection } = state;
            const { $cursor } = selection as any;
            
            // We only care about cursor selections
            if (!$cursor) {
              return false;
            }
            
            // Check if cursor is at the beginning of a node and there's a node before it
            if ($cursor.parentOffset === 0 && $cursor.pos > 0) {
              // Try to find a link node before current position
              let foundClickUpLink = false;
              let linkPos = -1;
              let linkNode: ProseMirrorNode | null = null;
              
              // Iterate through the document to find link nodes
              state.doc.nodesBetween($cursor.pos - 1, $cursor.pos, (node, pos) => {
                // Check if this is a text node with a link mark
                const linkMark = node.marks.find(mark => mark.type.name === 'link');
                if (linkMark) {
                  const url = linkMark.attrs.href || '';
                  const taskId = ClickUpTaskManager.extractTaskId(url);
                  
                  // If this is a ClickUp link
                  if (taskId) {
                    foundClickUpLink = true;
                    linkPos = pos;
                    linkNode = node;
                    return false; // Stop iterating
                  }
                }
                return true;
              });
              
              // If we found a ClickUp link before the cursor
              if (foundClickUpLink && linkNode && linkPos >= 0) {
                const linkSize = linkNode.nodeSize;
                const from = linkPos;
                const to = linkPos + linkSize;
                
                // Delete the link node
                dispatch(state.tr.delete(from, to));
                return true; // We handled the event
              }
            }
            
            return false; // Let other handlers process the event
          }
        }
      })
    ];
  },
  
  // All necessary methods have been implemented
});

// Add CSS for ClickUp links
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .clickup-link {
      position: relative;
    }
    
    .ProseMirror .clickup-task-card {
      display: inline-flex;
      align-items: center;
      border-radius: 4px;
      padding: 2px 8px;
      margin: 0 2px;
      background-color: rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.1);
      text-decoration: none !important;
    }
    
    .ProseMirror .clickup-task-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
    }
  `;
  document.head.appendChild(style);
}

export default ClickUpLinkExtension;
