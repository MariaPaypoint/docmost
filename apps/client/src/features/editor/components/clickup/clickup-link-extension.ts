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
          }
        }
      })
    ];
  }
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
