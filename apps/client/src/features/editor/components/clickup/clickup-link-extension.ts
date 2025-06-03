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
            
            // Deleting ClickUp link
            
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
    
    // Store current decoration set to avoid unnecessary recomputation
    let cachedDecorations: DecorationSet | null = null;
    let lastDocVersion = 0;
    
    // Flag to track if we're currently loading tasks
    let loadingTasks = false;
    
    // List of all tasks found in the document for batch loading
    const documentTasks = new Set<string>();
    
    // Flag to force redraw of decorations after task data is loaded
    let forceRedraw = false;

    return [
      new Plugin({
        key: new PluginKey('clickupLink'),
        
        // Use decorations to render ClickUp links
        props: {
          // Create decorations for ClickUp links
          decorations: (state) => {
            const { doc } = state;
            
            // Use a fingerprint of the document to detect real changes
            // This prevents excessive re-rendering when cursor moves or selection changes
            const docFingerprint = state.doc.nodeSize + state.selection.from;
            
            // Reuse cached decorations if document hasn't meaningfully changed and we're not loading tasks
            // Also check forceRedraw flag to ensure decorations are updated after task data is loaded
            if (cachedDecorations && docFingerprint === lastDocVersion && !loadingTasks && !forceRedraw) {
              return cachedDecorations;
            }
            
            // Reset forceRedraw flag after using it
            if (forceRedraw) {
              forceRedraw = false;
            }
            
            // Update document fingerprint
            lastDocVersion = docFingerprint;
            
            const decorations: Decoration[] = [];
            documentTasks.clear();
            
            // Find all link nodes
            doc.descendants((node: ProseMirrorNode, pos: number) => {
              // Check if this node has a link mark
              const linkMark = node.marks.find(mark => mark.type.name === 'link');
              
              if (linkMark) {
                const url = linkMark.attrs.href || '';
                const taskId = ClickUpTaskManager.extractTaskId(url);
                
                // If this is a ClickUp link
                if (taskId) {
                  // Add to document tasks list for batch loading
                  documentTasks.add(taskId);
                  // Add decoration with custom rendering
                  const from = pos;
                  const to = pos + node.nodeSize;

                  // Generate the HTML for our custom ClickUp link display
                  const generateClickUpLinkHtml = (taskData: any) => {
                    const taskName = taskData?.name || 'ClickUp Task';
                    const statusColor = taskData?.status?.color || '#ddd';
                    const statusText = taskData?.status?.status || 'Status';
                    const taskType = taskData?.custom_item_id || 0;
                    
                    // Get priority info and determine color
                    let priorityColor = '#999'; // default gray
                    let priorityName = '';
                    
                    // Check if priority data exists
                    if (taskData?.priority) {
                      // Get priority name if available
                      if (taskData.priority.priority) {
                        priorityName = taskData.priority.priority;
                      }
                      
                      // Get color from API if available
                      if (taskData.priority.color) {
                        priorityColor = taskData.priority.color;
                        
                        // Determine priority name based on color if name is not available
                        if (!priorityName) {
                          // Map common ClickUp priority colors to names
                          if (priorityColor === '#f50000') {
                            priorityName = 'Urgent';
                          } else if (priorityColor === '#f8ae00') {
                            priorityName = 'High';
                          } else if (priorityColor === '#6fddff') {
                            priorityName = 'Normal';
                          } else if (priorityColor === '#d8d8d8') {
                            priorityName = 'Low';
                          } else {
                            priorityName = 'Priority';
                          }
                        }
                      }
                    }
                    
                    // Task data is loaded, now format for display
                    
                    // Process assignee information
                    let assigneeNames = 'No assignees';
                    
                    // In ClickUp API, assignees can be in different fields
                    if (taskData?.assignees && Array.isArray(taskData.assignees) && taskData.assignees.length > 0) {
                      // Try to get names from different fields in the API
                      const names = taskData.assignees
                        .filter(a => a && (a.username || a.email || a.displayName || a.name))
                        .map(a => a.username || a.email || a.displayName || a.name)
                        .filter(Boolean);
                      
                      if (names.length > 0) {
                        assigneeNames = names.join(', ') || 'Not assigned';
                      }
                    } else if (taskData?.assignee) {
                      // Alternative API field
                      assigneeNames = taskData.assignee.username || 
                                    taskData.assignee.email || 
                                    taskData.assignee.displayName || 
                                    taskData.assignee.name || 
                                    'Not assigned';
                    }
                    
                    // Create HTML for priority flag
                    const priorityFlagHtml = priorityName ? `
                      <div class="clickup-tooltip-priority">
                        <span class="clickup-priority-flag" style="background-color: ${priorityColor}"></span>
                        <span>${priorityName}</span>
                      </div>
                    ` : '';
                    
                    // Create custom tooltip HTML
                    const tooltipHtml = `
                      <div class="clickup-custom-tooltip">
                        <div class="clickup-tooltip-status" style="background-color: ${statusColor}">
                          <span>${statusText}</span>
                        </div>
                        ${priorityFlagHtml}
                        ${assigneeNames !== 'Not assigned' ? `
                        <div class="clickup-tooltip-assignees">
                          <span>👤 ${assigneeNames}</span>
                        </div>
                        ` : ''}
                      </div>
                    `;
                    
                    // Get task type icon based on custom_item_id from ClickUp API
                    const getTaskTypeIcon = (taskType: number) => {
                      switch (taskType) {
                        case 1: // milestone
                          return `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"  fill="currentColor"  class="icon icon-tabler icons-tabler-filled icon-tabler-square-rotated"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9.793 2.893l-6.9 6.9c-1.172 1.171 -1.172 3.243 0 4.414l6.9 6.9c1.171 1.172 3.243 1.172 4.414 0l6.9 -6.9c1.172 -1.171 1.172 -3.243 0 -4.414l-6.9 -6.9c-1.171 -1.172 -3.243 -1.172 -4.414 0z" /></svg>
                          `;
                        case 1001: // bug
                          return `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"  fill="currentColor"  class="icon icon-tabler icons-tabler-filled icon-tabler-bug"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 4a4 4 0 0 1 3.995 3.8l.005 .2a1 1 0 0 1 .428 .096l3.033 -1.938a1 1 0 1 1 1.078 1.684l-3.015 1.931a7.17 7.17 0 0 1 .476 2.227h3a1 1 0 0 1 0 2h-3v1a6.01 6.01 0 0 1 -.195 1.525l2.708 1.616a1 1 0 1 1 -1.026 1.718l-2.514 -1.501a6.002 6.002 0 0 1 -3.973 2.56v-5.918a1 1 0 0 0 -2 0v5.917a6.002 6.002 0 0 1 -3.973 -2.56l-2.514 1.503a1 1 0 1 1 -1.026 -1.718l2.708 -1.616a6.01 6.01 0 0 1 -.195 -1.526v-1h-3a1 1 0 0 1 0 -2h3.001v-.055a7 7 0 0 1 .474 -2.173l-3.014 -1.93a1 1 0 1 1 1.078 -1.684l3.032 1.939l.024 -.012l.068 -.027l.019 -.005l.016 -.006l.032 -.008l.04 -.013l.034 -.007l.034 -.004l.045 -.008l.015 -.001l.015 -.002l.087 -.004a4 4 0 0 1 4 -4zm0 2a2 2 0 0 0 -2 2h4a2 2 0 0 0 -2 -2z" /></svg>
                          `;
                        case 1002: // question
                          return `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="3"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-question-mark"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4" /><path d="M12 19l0 .01" /></svg>
                          `;
                        case 1005: // group
                          return `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="3"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-border-corners"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1 -2 2h-2" /><path d="M8 20h-2a2 2 0 0 1 -2 -2v-2" /><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /></svg>
                          `;
                        case 1007: // repeatable
                          return `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="3"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-reload"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19.933 13.041a8 8 0 1 1 -9.925 -8.788c3.899 -1 7.935 1.007 9.425 4.747" /><path d="M20 4v5h-5" /></svg>
                          `;
                        case 3: // form_response
                          return `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"  fill="currentColor"  class="icon icon-tabler icons-tabler-filled icon-tabler-clipboard-text"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17.997 4.17a3 3 0 0 1 2.003 2.83v12a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 2.003 -2.83a4 4 0 0 0 3.997 3.83h4a4 4 0 0 0 3.98 -3.597zm-2.997 10.83h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m0 -4h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m-1 -9a2 2 0 1 1 0 4h-4a2 2 0 1 1 0 -4z" /></svg>
                          `;
                        default: // default circle
                          return `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"  fill="currentColor"  class="icon icon-tabler icons-tabler-filled icon-tabler-circle"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 3.34a10 10 0 1 1 -4.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 4.995 -8.336z" /></svg>
                          `;
                      }
                    };

                    // Create a single clickable link containing the task icon, name and external link indicator
                    return `
                      <span class="clickup-link-container" data-task-id="${taskData?.id || ''}">
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="clickup-link-content">
                          <span class="clickup-task-status" style="color: ${statusColor}">${getTaskTypeIcon(taskType)}</span>
                          <span class="clickup-task-name">${taskName}</span>
                          <span class="clickup-external-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                              <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                              <path d="M11 13l9 -9" />
                              <path d="M15 4h5v5" />
                            </svg>
                          </span>
                        </a>
                        <div class="clickup-tooltip-wrapper">
                          ${tooltipHtml}
                        </div>
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
                            <span class="clickup-task-status" style="color: #ddd">
                              <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                                <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                              </svg>
                            </span>
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
                    // Task loading is now handled in batch at the end of the decorations function
                    // No need to load individual tasks here, they'll be loaded in a batch
                    // This prevents multiple redraws for each task
                  }
                }
              }
              
              return true;
            });
            
            // Cache the decorations
            cachedDecorations = DecorationSet.create(doc, decorations);
            
            // If we found tasks that need to be loaded, load them in batch
            if (!loadingTasks) {
              const tasksToLoad = Array.from(documentTasks).filter(id => !taskCache[id]);
              
              if (tasksToLoad.length > 0) {
                loadingTasks = true;
                
                // Load tasks sequentially to avoid hammering the server
                const loadTasksBatch = async () => {
                  for (const taskId of tasksToLoad) {
                    try {
                      console.log('Loading task data for:', taskId);
                      // Get task data
                      const taskData = await ClickUpTaskManager.getTask(taskId);
                      // Save in cache
                      taskCache[taskId] = taskData;
                      
                      // For debugging, log task data
                      console.log('ClickUp Task Data:', taskData);
                      if (taskData && 'assignees' in taskData) {
                        console.log('Assignees:', (taskData as any).assignees);
                      }
                      // Data already fetched and logged above
                    } catch (error) {
                      console.error('[ClickUpExt] Error fetching task:', error);
                    }
                  }
                  
                  // Mark loading as complete and force one update
                  loadingTasks = false;
                  // Set flag to force redraw of decorations
                  forceRedraw = true;
                  
                  // Force redraw of decorations
                  if (this.editor) {
                    // This transaction will force the editor to redraw decorations
                    setTimeout(() => {
                      if (this.editor) {
                        this.editor.view.dispatch(this.editor.state.tr);
                        // console.log('Forcing redraw after loading all tasks');
                      }
                    }, 10); // Small delay to ensure update
                  }
                };
                
                loadTasksBatch();
              }
            }
            
            return cachedDecorations;
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      margin-right: 6px;
    }
    
    .ProseMirror .clickup-task-status svg {
      width: 16px;
      height: 16px;
    }
  `;
  document.head.appendChild(style);
}

export default ClickUpLinkExtension;
